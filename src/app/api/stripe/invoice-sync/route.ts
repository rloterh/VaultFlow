import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@/config/roles";
import { syncStripeInvoiceReferences } from "@/lib/stripe/client";
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
    const canSync =
      !!role &&
      (hasPermission(role, "org:billing") ||
        hasPermission(role, "invoices:send") ||
        hasPermission(role, "invoices:update"));

    if (!canSync) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!invoice.stripe_invoice_id && !invoice.stripe_payment_intent_id) {
      return NextResponse.json({
        syncedInvoice: false,
        syncedPaymentIntent: false,
        skipped: true,
      });
    }

    const result = await syncStripeInvoiceReferences({
      orgId: invoice.org_id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      stripeInvoiceId: invoice.stripe_invoice_id,
      stripePaymentIntentId: invoice.stripe_payment_intent_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Invoice sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync invoice metadata with Stripe" },
      { status: 500 }
    );
  }
}
