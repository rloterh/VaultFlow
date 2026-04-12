import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface RecordActivityInput {
  orgId: string;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function recordActivity({
  orgId,
  userId,
  entityType,
  entityId,
  action,
  metadata = {},
}: RecordActivityInput): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("activity_log").insert({
    org_id: orgId,
    user_id: userId ?? null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    metadata,
  });

  if (error) {
    console.error("Failed to record activity:", error);
    return false;
  }

  return true;
}
