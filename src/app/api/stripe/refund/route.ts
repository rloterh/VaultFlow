import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@/config/roles";
import { createStripeRefund, syncStripeInvoiceReferences } from "@/lib/stripe/client";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoiceId, amount, note } = await request.json();

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json({ error: "Invalid invoice" }, { status: 400 });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        "id, org_id, invoice_number, amount_paid, refunded_amount, stripe_invoice_id, stripe_payment_intent_id"
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
    if (!role || !hasPermission(role, "org:billing")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!invoice.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: "Stripe payment intent is required before issuing a Stripe refund." },
        { status: 400 }
      );
    }

    const refundableAmount = Math.max(
      Number(invoice.amount_paid ?? 0) - Number(invoice.refunded_amount ?? 0),
      0
    );

    if (amount > refundableAmount) {
      return NextResponse.json(
        {
          error: `Only ${refundableAmount.toFixed(2)} is currently available to refund.`,
        },
        { status: 400 }
      );
    }

    await syncStripeInvoiceReferences({
      orgId: invoice.org_id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      stripeInvoiceId: invoice.stripe_invoice_id,
      stripePaymentIntentId: invoice.stripe_payment_intent_id,
    });

    const refund = await createStripeRefund({
      paymentIntentId: invoice.stripe_payment_intent_id,
      amount,
      metadata: {
        org_id: invoice.org_id,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        billing_reference: `${invoice.org_id}:${invoice.id}:${invoice.invoice_number}`,
        requested_by: user.id,
        adjustment_note:
          typeof note === "string" && note.trim().length > 0 ? note.trim() : "",
      },
    });

    return NextResponse.json({
      refundId: refund.id,
      status: refund.status,
      amount: (refund.amount ?? 0) / 100,
      currency: refund.currency ?? null,
    });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe refund" },
      { status: 500 }
    );
  }
}
