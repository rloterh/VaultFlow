import type { Role } from "@/config/roles";

// ============================================
// DATABASE TYPES (mirrors Supabase schema)
// ============================================

export type OrgPlan = "free" | "pro" | "enterprise";
export type InviteStatus = "pending" | "accepted" | "expired";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: OrgPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  id: string;
  user_id: string;
  org_id: string;
  role: Role;
  is_active: boolean;
  joined_at: string;
  // Joined data
  profile?: Profile;
  organization?: Organization;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  invited_by: string;
  status: InviteStatus;
  token: string;
  expires_at: string;
  created_at: string;
}

// ============================================
// AUTH TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
  memberships: OrgMembership[];
  currentOrg: Organization | null;
  currentRole: Role | null;
}

export interface SessionContext {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
