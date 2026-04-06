"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  return <>{children}</>;
}
