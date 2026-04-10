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

export interface RoleMetadata {
  title: string;
  description: string;
  capabilities: string[];
  badgeVariant: "info" | "success" | "warning" | "default";
}

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

export const ROLE_METADATA: Record<Role, RoleMetadata> = {
  owner: {
    title: "Owner",
    description: "Full commercial and governance control across the workspace.",
    capabilities: [
      "Manage billing and subscription posture",
      "Control team access and privileged role changes",
      "Oversee all client, invoice, and settings surfaces",
    ],
    badgeVariant: "info",
  },
  admin: {
    title: "Admin",
    description: "Operational leader with workspace and access-management authority.",
    capabilities: [
      "Manage team lifecycle and pending invites",
      "Own invoice workflow and client operations",
      "Export reports and update workspace settings",
    ],
    badgeVariant: "success",
  },
  manager: {
    title: "Manager",
    description: "Hands-on operator focused on receivables, clients, and reporting.",
    capabilities: [
      "Create and update invoices",
      "Manage client records and workflow follow-up",
      "Monitor reporting without privileged admin controls",
    ],
    badgeVariant: "warning",
  },
  member: {
    title: "Member",
    description: "Read-oriented collaborator with visibility into the operating workspace.",
    capabilities: [
      "Review invoices, clients, and reports",
      "Monitor workflow posture without changing state",
      "Access settings relevant to their account",
    ],
    badgeVariant: "default",
  },
};

export const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: Permission[];
}> = [
  {
    label: "Organization",
    permissions: ["org:update", "org:delete", "org:billing"],
  },
  {
    label: "People",
    permissions: ["members:invite", "members:remove", "members:update-role"],
  },
  {
    label: "Invoices",
    permissions: [
      "invoices:create",
      "invoices:read",
      "invoices:update",
      "invoices:delete",
      "invoices:send",
    ],
  },
  {
    label: "Clients",
    permissions: ["clients:create", "clients:read", "clients:update", "clients:delete"],
  },
  {
    label: "Reporting",
    permissions: ["reports:read", "reports:export"],
  },
  {
    label: "Settings",
    permissions: ["settings:read", "settings:update"],
  },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "org:update": "Update org",
  "org:delete": "Delete org",
  "org:billing": "Billing access",
  "members:invite": "Invite members",
  "members:remove": "Remove members",
  "members:update-role": "Change roles",
  "invoices:create": "Create invoices",
  "invoices:read": "Read invoices",
  "invoices:update": "Update invoices",
  "invoices:delete": "Delete invoices",
  "invoices:send": "Send invoices",
  "clients:create": "Create clients",
  "clients:read": "Read clients",
  "clients:update": "Update clients",
  "clients:delete": "Delete clients",
  "reports:read": "Read reports",
  "reports:export": "Export reports",
  "settings:read": "Read settings",
  "settings:update": "Update settings",
};

// Role hierarchy: higher index = higher authority
export const ROLE_HIERARCHY: Role[] = ["member", "manager", "admin", "owner"];

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: Role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole);
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(actorRole) > ROLE_HIERARCHY.indexOf(targetRole);
}
