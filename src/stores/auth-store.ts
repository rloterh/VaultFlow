import { create } from "zustand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile, OrgMembership } from "@/types/auth";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  memberships: OrgMembership[];
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setMemberships: (memberships: OrgMembership[]) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  memberships: [],
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    const supabase = getSupabaseBrowserClient();

    try {
      // Get current session
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        set({ user: null, profile: null, memberships: [], isLoading: false, isInitialized: true });
        return;
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Fetch memberships with org data
      const { data: memberships } = await supabase
        .from("org_memberships")
        .select("*, organization:organizations(*)")
        .eq("user_id", user.id)
        .eq("is_active", true);

      set({
        user,
        profile,
        memberships: memberships ?? [],
        isLoading: false,
        isInitialized: true,
      });

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT") {
          set({ user: null, profile: null, memberships: [], isLoading: false });
        } else if (event === "SIGNED_IN" && session?.user) {
          set({ user: session.user });
          await get().refreshProfile();
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          set({ user: session.user });
        }
      });
    } catch (error) {
      console.error("Auth initialization failed:", error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  setUser: (user) => set({ user }),

  setProfile: (profile) => set({ profile }),

  setMemberships: (memberships) => set({ memberships }),

  signOut: async () => {
    const supabase = getSupabaseBrowserClient();
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ user: null, profile: null, memberships: [], isLoading: false });
  },

  refreshProfile: async () => {
    const supabase = getSupabaseBrowserClient();
    const { user } = get();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data: memberships } = await supabase
      .from("org_memberships")
      .select("*, organization:organizations(*)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    set({ profile, memberships: memberships ?? [] });
  },
}));
