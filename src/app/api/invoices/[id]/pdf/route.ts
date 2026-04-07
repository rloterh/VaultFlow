import { NextResponse } from "next/server";
import { getSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { generateInvoicePDF } from "@/lib/pdf/invoice-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    // Fetch invoice with client and items
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*, client:clients(*), items:invoice_items(*)")
      .eq("id", id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Verify user has access (via RLS this is already enforced, but double-check)
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", invoice.org_id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get org name for branding
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invoice.org_id)
      .single();

    const pdfBuffer = generateInvoicePDF(invoice as any, org?.name ?? "VaultFlow");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
