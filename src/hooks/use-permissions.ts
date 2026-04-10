"use client";

import { useMemo } from "react";
import { useOrgStore } from "@/stores/org-store";
import {
  hasPermission,
  hasMinRole,
  type Permission,
  type Role,
} from "@/config/roles";

export function usePermissions() {
  const currentRole = useOrgStore((s) => s.currentRole);

  const permissions = useMemo(() => {
    return {
      /** Check if user has a specific permission */
      can: (permission: Permission): boolean => {
        if (!currentRole) return false;
        return hasPermission(currentRole, permission);
      },

      /** Check if user has at least the given role level */
      hasRole: (minRole: Role): boolean => {
        if (!currentRole) return false;
        return hasMinRole(currentRole, minRole);
      },

      /** Current role (null if no org selected) */
      role: currentRole,

      /** Quick role checks */
      isOwner: currentRole === "owner",
      isAdmin: currentRole === "admin" || currentRole === "owner",
      isFinanceManager: currentRole === "finance_manager",
      isManager: hasMinRole(currentRole ?? "viewer", "manager"),
      isMember: !!currentRole,
    };
  }, [currentRole]);

  return permissions;
}
