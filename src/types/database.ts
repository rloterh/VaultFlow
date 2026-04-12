import type { OrgMembership } from "./auth";

// Re-export Phase 1 types
export type { Profile, Organization, OrgMembership, OrgInvite, AuthUser, ApiResponse, PaginatedResponse } from "./auth";
export type { OrgPlan, InviteStatus } from "./auth";

// ============================================
// PHASE 2 TYPES
// ============================================

export type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";
export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export interface Client {
  id: string;
  org_id: string;
  name: string;
  email: string;
  stripe_customer_id?: string | null;
  phone: string | null;
  company: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  notes: string | null;
  is_active: boolean;
  total_revenue: number;
  invoice_count: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: Currency;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  stripe_invoice_id?: string | null;
  stripe_payment_intent_id?: string | null;
  last_payment_failed_at?: string | null;
  last_payment_received_at?: string | null;
  last_recovery_reviewed_at?: string | null;
  credited_amount?: number;
  refunded_amount?: number;
  voided_at?: string | null;
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  sent_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined
  profile?: { full_name: string | null; avatar_url: string | null };
}

export interface VendorClientAssignment {
  id: string;
  org_id: string;
  membership_id: string;
  client_id: string;
  assigned_by: string | null;
  created_at: string;
  client?: Pick<Client, "id" | "name" | "company"> | null;
  membership?: Pick<OrgMembership, "id" | "user_id" | "role"> | null;
}

export interface InvoicePaymentEvent {
  id: string;
  org_id: string;
  invoice_id: string | null;
  actor_user_id: string | null;
  stripe_event_id?: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id?: string | null;
  stripe_credit_note_id?: string | null;
  source: string;
  event_type: string;
  status:
    | "pending"
    | "succeeded"
    | "failed"
    | "reviewed"
    | "refunded"
    | "credited"
    | "voided";
  amount: number;
  currency: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// DASHBOARD ANALYTICS TYPES
// ============================================

export interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  invoicesSent: number;
  invoicesChange: number;
  activeClients: number;
  clientsChange: number;
  overdueAmount: number;
  overdueChange: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  invoices: number;
}

export interface StatusDistribution {
  status: InvoiceStatus;
  count: number;
  amount: number;
}

export interface TopClient {
  id: string;
  name: string;
  company: string | null;
  total_revenue: number;
  invoice_count: number;
}

// ============================================
// TABLE / FILTER TYPES
// ============================================

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface FilterConfig {
  search: string;
  status?: InvoiceStatus | "all";
  dateRange?: { from: string; to: string };
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}
