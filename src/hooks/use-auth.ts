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

  useEffect(() => {
    if (!isInitialized) {
      void initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (!user || memberships.length === 0) {
      if (currentOrg) {
        useOrgStore.getState().clear();
      }
      return;
    }

    const matchingMembership = memberships.find(
      (membership) => membership.org_id === currentOrg?.id
    );

    if (matchingMembership?.organization) {
      if (matchingMembership.role !== currentRole) {
        useOrgStore
          .getState()
          .setCurrentOrg(matchingMembership.organization, matchingMembership.role);
      }
      return;
    }

    const firstMembership = memberships[0];
    if (firstMembership?.organization) {
      useOrgStore
        .getState()
        .setCurrentOrg(firstMembership.organization, firstMembership.role);
    }
  }, [currentOrg, currentRole, memberships, user]);

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
