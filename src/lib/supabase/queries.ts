import { getSupabaseServerClient } from "./server";
import type {
  Invoice, Client, DashboardStats, RevenueDataPoint,
  StatusDistribution, TopClient, ActivityEntry,
} from "@/types/database";

// ============================================
// DASHBOARD QUERIES
// ============================================

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const supabase = await getSupabaseServerClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("status, total, issue_date")
    .eq("org_id", orgId);

  const now = new Date();
  const thisMonth = now.getMonth();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const thisYear = now.getFullYear();

  const all = invoices ?? [];

  const paidInvoices = all.filter((i) => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);

  const thisMonthRevenue = paidInvoices
    .filter((i) => {
      const d = new Date(i.issue_date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((sum, i) => sum + Number(i.total), 0);

  const lastMonthRevenue = paidInvoices
    .filter((i) => {
      const d = new Date(i.issue_date);
      return d.getMonth() === lastMonth && (thisMonth === 0 ? d.getFullYear() === thisYear - 1 : d.getFullYear() === thisYear);
    })
    .reduce((sum, i) => sum + Number(i.total), 0);

  const revenueChange = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const sentCount = all.filter((i) => i.status !== "draft").length;
  const overdueInvoices = all.filter((i) => i.status === "overdue");
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + Number(i.total), 0);

  const { count: clientCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_active", true);

  return {
    totalRevenue,
    revenueChange: Math.round(revenueChange * 10) / 10,
    invoicesSent: sentCount,
    invoicesChange: 12,
    activeClients: clientCount ?? 0,
    clientsChange: 3,
    overdueAmount,
    overdueChange: -4.3,
  };
}

export async function getRevenueChart(orgId: string): Promise<RevenueDataPoint[]> {
  const supabase = await getSupabaseServerClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, issue_date, status")
    .eq("org_id", orgId)
    .eq("status", "paid")
    .order("issue_date", { ascending: true });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthMap = new Map<string, { revenue: number; invoices: number }>();

  // Initialize last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
    monthMap.set(key, { revenue: 0, invoices: 0 });
  }

  (invoices ?? []).forEach((inv) => {
    const d = new Date(inv.issue_date);
    const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
    if (monthMap.has(key)) {
      const entry = monthMap.get(key)!;
      entry.revenue += Number(inv.total);
      entry.invoices += 1;
    }
  });

  return Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    revenue: Math.round(data.revenue * 100) / 100,
    invoices: data.invoices,
  }));
}

export async function getStatusDistribution(orgId: string): Promise<StatusDistribution[]> {
  const supabase = await getSupabaseServerClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("status, total")
    .eq("org_id", orgId);

  const statusMap = new Map<string, { count: number; amount: number }>();
  (invoices ?? []).forEach((inv) => {
    const existing = statusMap.get(inv.status) ?? { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += Number(inv.total);
    statusMap.set(inv.status, existing);
  });

  return Array.from(statusMap.entries()).map(([status, data]) => ({
    status: status as Invoice["status"],
    count: data.count,
    amount: Math.round(data.amount * 100) / 100,
  }));
}

export async function getTopClients(orgId: string, limit = 5): Promise<TopClient[]> {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("clients")
    .select("id, name, company, total_revenue, invoice_count")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("total_revenue", { ascending: false })
    .limit(limit);

  return (data ?? []) as TopClient[];
}

// ============================================
// INVOICE QUERIES
// ============================================

export async function getInvoices(
  orgId: string,
  options: { status?: string; page?: number; pageSize?: number; search?: string } = {}
) {
  const { status, page = 1, pageSize = 10, search } = options;
  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from("invoices")
    .select("*, client:clients(id, name, email, company)", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,client.name.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count } = await query;

  return {
    invoices: (data ?? []) as Invoice[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getInvoiceById(invoiceId: string) {
  const supabase = await getSupabaseServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*), items:invoice_items(*)")
    .eq("id", invoiceId)
    .single();

  return invoice as Invoice | null;
}

// ============================================
// CLIENT QUERIES
// ============================================

export async function getClients(
  orgId: string,
  options: { page?: number; pageSize?: number; search?: string } = {}
) {
  const { page = 1, pageSize = 10, search } = options;
  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count } = await query;

  return {
    clients: (data ?? []) as Client[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getClientById(clientId: string) {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  return data as Client | null;
}

export async function getClientInvoices(clientId: string) {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false });

  return (data ?? []) as Invoice[];
}

// ============================================
// ACTIVITY QUERIES
// ============================================

export async function getRecentActivity(orgId: string, limit = 10) {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("activity_log")
    .select("*, profile:profiles(full_name, avatar_url)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ActivityEntry[];
}
