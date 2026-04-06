import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Organization, OrgMembership } from "@/types/auth";
import type { Role } from "@/config/roles";

interface OrgState {
  currentOrg: Organization | null;
  currentRole: Role | null;
  members: OrgMembership[];
  isLoading: boolean;

  // Actions
  setCurrentOrg: (org: Organization, role: Role) => void;
  switchOrg: (orgId: string, memberships: OrgMembership[]) => void;
  fetchMembers: () => Promise<void>;
  createOrg: (name: string, slug: string) => Promise<Organization | null>;
  clear: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      currentOrg: null,
      currentRole: null,
      members: [],
      isLoading: false,

      setCurrentOrg: (org, role) => set({ currentOrg: org, currentRole: role }),

      switchOrg: (orgId, memberships) => {
        const membership = memberships.find((m) => m.org_id === orgId);
        if (membership?.organization) {
          set({
            currentOrg: membership.organization,
            currentRole: membership.role,
            members: [],
          });
        }
      },

      fetchMembers: async () => {
        const { currentOrg } = get();
        if (!currentOrg) return;

        set({ isLoading: true });
        const supabase = getSupabaseBrowserClient();

        const { data } = await supabase
          .from("org_memberships")
          .select("*, profile:profiles(*)")
          .eq("org_id", currentOrg.id)
          .eq("is_active", true)
          .order("joined_at", { ascending: true });

        set({ members: data ?? [], isLoading: false });
      },

      createOrg: async (name, slug) => {
        const supabase = getSupabaseBrowserClient();
        set({ isLoading: true });

        // Create org
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({ name, slug })
          .select()
          .single();

        if (orgError || !org) {
          set({ isLoading: false });
          return null;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          set({ isLoading: false });
          return null;
        }

        // Create owner membership
        await supabase.from("org_memberships").insert({
          user_id: user.id,
          org_id: org.id,
          role: "owner",
        });

        set({ currentOrg: org, currentRole: "owner", isLoading: false });
        return org;
      },

      clear: () => set({ currentOrg: null, currentRole: null, members: [] }),
    }),
    {
      name: "vaultflow-org",
      partialize: (state) => ({
        currentOrg: state.currentOrg,
        currentRole: state.currentRole,
      }),
    }
  )
);
