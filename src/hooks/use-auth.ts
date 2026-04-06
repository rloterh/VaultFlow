"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";

export function useAuth() {
  const {
    user,
    profile,
    memberships,
    isLoading,
    isInitialized,
    initialize,
    signOut,
    refreshProfile,
  } = useAuthStore();

  const { currentOrg, currentRole } = useOrgStore();

  // Initialize auth on first mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Auto-select first org if none selected
  useEffect(() => {
    if (!currentOrg && memberships.length > 0) {
      const firstMembership = memberships[0];
      if (firstMembership.organization) {
        useOrgStore.getState().setCurrentOrg(
          firstMembership.organization,
          firstMembership.role
        );
      }
    }
  }, [currentOrg, memberships]);

  return {
    user,
    profile,
    memberships,
    currentOrg,
    currentRole,
    isLoading,
    isAuthenticated: !!user,
    isInitialized,
    signOut,
    refreshProfile,
  };
}
