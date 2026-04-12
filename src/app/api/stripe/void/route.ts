import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@/config/roles";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { voidStripeInvoice } from "@/lib/stripe/client";

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
      .select("id, org_id, invoice_number, stripe_invoice_id, stripe_payment_intent_id")
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
        { error: "A linked Stripe invoice is required before voiding in Stripe." },
        { status: 400 }
      );
    }

    const voided = await voidStripeInvoice({
      stripeInvoiceId: invoice.stripe_invoice_id,
      stripePaymentIntentId: invoice.stripe_payment_intent_id ?? null,
      reference: {
        orgId: invoice.org_id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      },
    });

    return NextResponse.json({
      stripeInvoiceId: voided.id,
      status: voided.status,
    });
  } catch (error) {
    console.error("Void invoice error:", error);
    return NextResponse.json(
      { error: "Failed to void Stripe invoice" },
      { status: 500 }
    );
  }
}
