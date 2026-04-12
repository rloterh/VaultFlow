import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@/config/roles";
import { createStripeCreditNote, syncStripeInvoiceReferences } from "@/lib/stripe/client";
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
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        "id, org_id, invoice_number, total, amount_paid, refunded_amount, credited_amount, stripe_invoice_id, stripe_payment_intent_id"
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

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json(
        { error: "A linked Stripe invoice is required before issuing a credit note." },
        { status: 400 }
      );
    }

    const maxCreditable = Math.max(
      Number(invoice.total) -
        Math.max(
          Number(invoice.amount_paid ?? 0) - Number(invoice.refunded_amount ?? 0),
          0
        ) -
        Number(invoice.credited_amount ?? 0),
      0
    );

    if (amount > maxCreditable) {
      return NextResponse.json(
        { error: `Only ${maxCreditable.toFixed(2)} remains open on this invoice.` },
        { status: 400 }
      );
    }

    await syncStripeInvoiceReferences({
      orgId: invoice.org_id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      stripeInvoiceId: invoice.stripe_invoice_id,
      stripePaymentIntentId: invoice.stripe_payment_intent_id ?? null,
    });

    const creditNote = await createStripeCreditNote({
      stripeInvoiceId: invoice.stripe_invoice_id,
      amount,
      memo: typeof note === "string" ? note.trim() : null,
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
      creditNoteId: creditNote.id,
      amount: (creditNote.amount ?? 0) / 100,
      status: "created",
    });
  } catch (error) {
    console.error("Credit note error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe credit note" },
      { status: 500 }
    );
  }
}
