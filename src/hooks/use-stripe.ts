"use client";

import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";

export function useStripeCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  async function checkout(orgId: string, plan: "pro" | "enterprise") {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast({ type: "error", title: "Checkout failed", description: data.error });
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      addToast({ type: "error", title: "Something went wrong" });
    } finally {
      setIsLoading(false);
    }
  }

  return { checkout, isLoading };
}

export function useStripePortal() {
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  async function openPortal(orgId: string) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast({ type: "error", title: "Portal error", description: data.error });
        return;
      }

      window.location.href = data.url;
    } catch {
      addToast({ type: "error", title: "Something went wrong" });
    } finally {
      setIsLoading(false);
    }
  }

  return { openPortal, isLoading };
}
