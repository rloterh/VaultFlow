import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export async function logInvoiceActivity({
  orgId,
  userId,
  invoiceId,
  invoiceNumber,
  action,
  metadata = {},
}: {
  orgId: string;
  userId: string | null;
  invoiceId: string;
  invoiceNumber: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseBrowserClient();

  await supabase.from("activity_log").insert({
    org_id: orgId,
    user_id: userId,
    entity_type: "invoice",
    entity_id: invoiceId,
    action,
    metadata: {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      ...metadata,
    },
  });
}
