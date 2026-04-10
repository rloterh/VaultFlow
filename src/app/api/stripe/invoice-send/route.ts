import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@/config/roles";
import {
  createAndSendStripeInvoice,
  getOrCreateInvoiceCustomer,
  sendExistingStripeInvoice,
} from "@/lib/stripe/client";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoiceId } = await request.json();

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json({ error: "Invalid invoice" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        "id, org_id, client_id, invoice_number, currency, due_date, subtotal, tax_amount, discount_amount, stripe_invoice_id, stripe_payment_intent_id, client:clients(id, name, email, stripe_customer_id), items:invoice_items(description, quantity, unit_price)"
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", invoice.org_id)
      .eq("is_active", true)
      .maybeSingle();

    const role = membership?.role as Role | undefined;
    if (!role || !hasPermission(role, "invoices:send")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = Array.isArray(invoice.client)
      ? invoice.client[0]
      : invoice.client;

    if (!client?.email) {
      return NextResponse.json(
        { error: "Client email is required before sending through Stripe." },
        { status: 400 }
      );
    }

    const customerId = await getOrCreateInvoiceCustomer({
      orgId: invoice.org_id,
      clientId: client.id,
      clientName: client.name ?? "Client",
      email: client.email,
      existingCustomerId: client.stripe_customer_id ?? null,
    });

    if (customerId !== client.stripe_customer_id) {
      await supabase
        .from("clients")
        .update({ stripe_customer_id: customerId })
        .eq("id", client.id);
    }

    const lineItems = [
      ...((Array.isArray(invoice.items) ? invoice.items : []) ?? []).map((item) => ({
        description: item.description,
        unitAmount: Number(item.unit_price),
        quantity: Number(item.quantity),
      })),
      ...(Number(invoice.tax_amount ?? 0) > 0
        ? [{ description: "Tax", unitAmount: Number(invoice.tax_amount), quantity: 1 }]
        : []),
      ...(Number(invoice.discount_amount ?? 0) > 0
        ? [
            {
              description: "Discount",
              unitAmount: -Number(invoice.discount_amount),
              quantity: 1,
            },
          ]
        : []),
    ];

    const result = invoice.stripe_invoice_id
      ? await sendExistingStripeInvoice({
          stripeInvoiceId: invoice.stripe_invoice_id,
          reference: {
            orgId: invoice.org_id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
          },
          stripePaymentIntentId: invoice.stripe_payment_intent_id ?? null,
        })
      : await createAndSendStripeInvoice({
          customerId,
          currency: invoice.currency,
          dueDate: invoice.due_date,
          items:
            lineItems.length > 0
              ? lineItems
              : [
                  {
                    description: `Invoice ${invoice.invoice_number}`,
                    unitAmount:
                      Number(invoice.subtotal ?? 0) +
                      Number(invoice.tax_amount ?? 0) -
                      Number(invoice.discount_amount ?? 0),
                    quantity: 1,
                  },
                ],
          reference: {
            orgId: invoice.org_id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
          },
        });

    await supabase
      .from("invoices")
      .update({
        stripe_invoice_id: result.stripeInvoiceId,
        stripe_payment_intent_id: result.stripePaymentIntentId,
      })
      .eq("id", invoice.id);

    return NextResponse.json({
      stripeInvoiceId: result.stripeInvoiceId,
      stripePaymentIntentId: result.stripePaymentIntentId,
      stripeCustomerId: customerId,
    });
  } catch (error) {
    console.error("Invoice send error:", error);
    return NextResponse.json(
      { error: "Failed to create or send the Stripe invoice." },
      { status: 500 }
    );
  }
}
