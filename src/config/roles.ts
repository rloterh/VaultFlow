// ============================================
// RBAC CONFIGURATION
// Defines roles, permissions, and access levels
// ============================================

export type Role = "owner" | "admin" | "manager" | "member";

export type Permission =
  | "org:update"
  | "org:delete"
  | "org:billing"
  | "members:invite"
  | "members:remove"
  | "members:update-role"
  | "invoices:create"
  | "invoices:read"
  | "invoices:update"
  | "invoices:delete"
  | "invoices:send"
  | "clients:create"
  | "clients:read"
  | "clients:update"
  | "clients:delete"
  | "reports:read"
  | "reports:export"
  | "settings:read"
  | "settings:update";

// Permission matrix: maps each role to its allowed permissions
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "org:update", "org:delete", "org:billing",
    "members:invite", "members:remove", "members:update-role",
    "invoices:create", "invoices:read", "invoices:update", "invoices:delete", "invoices:send",
    "clients:create", "clients:read", "clients:update", "clients:delete",
    "reports:read", "reports:export",
    "settings:read", "settings:update",
  ],
  admin: [
    "org:update", "org:billing",
    "members:invite", "members:remove", "members:update-role",
    "invoices:create", "invoices:read", "invoices:update", "invoices:delete", "invoices:send",
    "clients:create", "clients:read", "clients:update", "clients:delete",
    "reports:read", "reports:export",
    "settings:read", "settings:update",
  ],
  manager: [
    "invoices:create", "invoices:read", "invoices:update", "invoices:send",
    "clients:create", "clients:read", "clients:update",
    "reports:read",
    "settings:read",
  ],
  member: [
    "invoices:read",
    "clients:read",
    "reports:read",
    "settings:read",
  ],
};

// Role hierarchy: higher index = higher authority
export const ROLE_HIERARCHY: Role[] = ["member", "manager", "admin", "owner"];

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole);
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(actorRole) > ROLE_HIERARCHY.indexOf(targetRole);
}
