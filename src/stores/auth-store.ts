import { create } from "zustand";
import type { AuthChangeEvent, Session, Subscription, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import type { OrgMembership, Profile } from "@/types/auth";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  memberships: OrgMembership[];
  isLoading: boolean;
  isInitialized: boolean;
  isInitializing: boolean;

  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setMemberships: (memberships: OrgMembership[]) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

let authSubscription: Subscription | null = null;

async function bootstrapStarterWorkspace() {
  const response = await fetch("/api/onboarding/bootstrap", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Starter workspace bootstrap failed");
  }
}

async function loadUserWorkspace(user: User) {
  const supabase = getSupabaseBrowserClient();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("org_memberships")
      .select("*, organization:organizations(*)")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  return {
    profile,
    memberships: (memberships ?? []) as OrgMembership[],
  };
}

async function loadOrBootstrapUserWorkspace(user: User) {
  const initialWorkspace = await loadUserWorkspace(user);

  if (initialWorkspace.memberships.length > 0) {
    return initialWorkspace;
  }

  await bootstrapStarterWorkspace();
  return loadUserWorkspace(user);
}

async function syncSessionState(
  set: (partial: Partial<AuthState>) => void,
  event: AuthChangeEvent,
  session: Session | null
) {
  if (event === "SIGNED_OUT" || !session?.user) {
    useOrgStore.getState().clear();
    set({
      user: null,
      profile: null,
      memberships: [],
      isLoading: false,
      isInitialized: true,
      isInitializing: false,
    });
    return;
  }

  const nextUser = session.user;
  const { profile, memberships } = await loadOrBootstrapUserWorkspace(nextUser);

  set({
    user: nextUser,
    profile,
    memberships,
    isLoading: false,
    isInitialized: true,
    isInitializing: false,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  memberships: [],
  isLoading: true,
  isInitialized: false,
  isInitializing: false,

  initialize: async () => {
    const state = get();
    if (state.isInitialized || state.isInitializing) {
      return;
    }

    set({ isInitializing: true, isLoading: true });
    const supabase = getSupabaseBrowserClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        useOrgStore.getState().clear();
        set({
          user: null,
          profile: null,
          memberships: [],
          isLoading: false,
          isInitialized: true,
          isInitializing: false,
        });
      } else {
        const { profile, memberships } = await loadOrBootstrapUserWorkspace(user);
        set({
          user,
          profile,
          memberships,
          isLoading: false,
          isInitialized: true,
          isInitializing: false,
        });
      }

      if (!authSubscription) {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          await syncSessionState(set, event, session);
        });

        authSubscription = subscription;
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
      useOrgStore.getState().clear();
      set({
        isLoading: false,
        isInitialized: true,
        isInitializing: false,
        user: null,
        profile: null,
        memberships: [],
      });
    }
  },

  setUser: (user) => set({ user }),

  setProfile: (profile) => set({ profile }),

  setMemberships: (memberships) => set({ memberships }),

  signOut: async () => {
    const supabase = getSupabaseBrowserClient();
    set({ isLoading: true });
    const { error } = await supabase.auth.signOut();

    if (error) {
      set({ isLoading: false });
      throw error;
    }

    useOrgStore.getState().clear();
    set({
      user: null,
      profile: null,
      memberships: [],
      isLoading: false,
      isInitialized: true,
      isInitializing: false,
    });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) {
      useOrgStore.getState().clear();
      return;
    }

    const { profile, memberships } = await loadOrBootstrapUserWorkspace(user);
    set({ profile, memberships });
  },
}));
