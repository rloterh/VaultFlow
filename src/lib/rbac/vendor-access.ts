import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/config/roles";
import type { Client, Invoice, VendorClientAssignment } from "@/types/database";

export function isVendorRole(role: Role | null | undefined) {
  return role === "vendor";
}

export async function fetchVendorAssignedClientIds(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | undefined
) {
  if (!userId) {
    return [];
  }

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!membership?.id) {
    return [];
  }

  const { data } = await supabase
    .from("vendor_client_assignments")
    .select("client_id")
    .eq("org_id", orgId)
    .eq("membership_id", membership.id);

  return Array.from(
    new Set((data ?? []).map((entry) => entry.client_id).filter(Boolean))
  );
}

export async function fetchVendorAssignmentsForOrg(
  supabase: SupabaseClient,
  orgId: string
) {
  const { data } = await supabase
    .from("vendor_client_assignments")
    .select("id, org_id, membership_id, client_id, assigned_by, created_at, client:clients(id, name, company)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((entry) => ({
    ...entry,
    client: Array.isArray(entry.client) ? entry.client[0] ?? null : entry.client ?? null,
  })) as VendorClientAssignment[];
}

export function filterClientsByAssignment(
  clients: Client[],
  assignedClientIds: string[]
) {
  if (assignedClientIds.length === 0) {
    return [];
  }

  const allowed = new Set(assignedClientIds);
  return clients.filter((client) => allowed.has(client.id));
}

export function filterInvoicesByAssignment(
  invoices: Invoice[],
  assignedClientIds: string[]
) {
  if (assignedClientIds.length === 0) {
    return [];
  }

  const allowed = new Set(assignedClientIds);
  return invoices.filter((invoice) => allowed.has(invoice.client_id));
}

export function isAssignedClient(
  clientId: string,
  assignedClientIds: string[]
) {
  return assignedClientIds.includes(clientId);
}
