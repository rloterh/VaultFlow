"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "./client";
import { useUIStore } from "@/stores/ui-store";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribe to invoice changes for real-time dashboard updates.
 * Triggers a toast notification on status changes.
 */
export function useInvoiceRealtime(orgId: string | undefined, onUpdate?: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    if (!orgId) return;
    const supabase = getSupabaseBrowserClient();

    channelRef.current = supabase
      .channel(`invoices:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invoices",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const { new: newRow, old: oldRow } = payload;
          if (newRow.status !== oldRow.status) {
            const statusLabels: Record<string, string> = {
              paid: "marked as paid",
              sent: "sent to client",
              viewed: "viewed by client",
              overdue: "is now overdue",
              cancelled: "was cancelled",
            };
            addToast({
              type: newRow.status === "paid" ? "success" : "info",
              title: `Invoice ${newRow.invoice_number}`,
              description: statusLabels[newRow.status] ?? `status changed to ${newRow.status}`,
            });
          }
          onUpdate?.();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invoices",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          addToast({
            type: "info",
            title: "New invoice created",
            description: `Invoice ${payload.new.invoice_number} has been created.`,
          });
          onUpdate?.();
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [orgId, onUpdate, addToast]);
}

/**
 * Subscribe to activity log for a live feed.
 */
export function useActivityRealtime(
  orgId: string | undefined,
  onNewActivity?: (entry: Record<string, unknown>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const supabase = getSupabaseBrowserClient();

    channelRef.current = supabase
      .channel(`activity:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          onNewActivity?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [orgId, onNewActivity]);
}
