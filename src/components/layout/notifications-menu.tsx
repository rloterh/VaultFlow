"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Clock3 } from "lucide-react";
import { ActionMenu, type ActionMenuSection } from "@/components/ui/action-menu";
import { ROLE_METADATA } from "@/config/roles";
import {
  getActivityHeadline,
  getActivityIcon,
  getActivityTone,
} from "@/lib/activity/presentation";
import {
  getActivityDestination,
  isAttentionActivity,
} from "@/lib/activity/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrgStore } from "@/stores/org-store";
import type { ActivityEntry } from "@/types/database";

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatBadgeCount(value: number) {
  return value > 9 ? "9+" : String(value);
}

function getNotificationPriority(entry: ActivityEntry, role: ReturnType<typeof usePermissions>["role"]) {
  let score = 0;

  if (isAttentionActivity(entry)) {
    score += 100;
  }

  const tone = getActivityTone(entry.action);
  if (tone === "danger") score += 40;
  if (tone === "warning") score += 24;
  if (entry.entity_type === "invoice") score += 12;
  if (entry.entity_type === "client") score += 8;

  if (role === "finance_manager") {
    if (
      entry.action.startsWith("payment_") ||
      entry.action.startsWith("subscription_") ||
      entry.action.startsWith("invoice.credit") ||
      entry.action.startsWith("invoice.void") ||
      entry.action === "invoice.overdue" ||
      entry.action === "invoice.payment_recorded" ||
      entry.action === "invoice.stripe_linked"
    ) {
      score += 36;
    }
  } else if (role === "vendor") {
    if (entry.entity_type === "invoice" || entry.entity_type === "client") {
      score += 28;
    }

    if (
      entry.action.startsWith("member.") ||
      entry.action.startsWith("subscription_") ||
      entry.action === "org.updated"
    ) {
      score -= 20;
    }
  } else if (role === "viewer" || role === "member") {
    if (
      entry.action === "invoice.overdue" ||
      entry.action === "payment_failed" ||
      entry.action === "invoice.recovery_reviewed"
    ) {
      score += 16;
    }

    if (entry.action.startsWith("member.") || entry.action === "org.updated") {
      score -= 10;
    }
  } else if (role === "admin" || role === "owner") {
    if (entry.action.startsWith("member.") || entry.action === "org.updated") {
      score += 22;
    }
  }

  return score;
}

function getNotificationsSummary(role: ReturnType<typeof usePermissions>["role"], attentionCount: number) {
  if (attentionCount > 0) {
    if (role === "finance_manager") {
      return "Highest-priority billing and recovery signals are pinned to the top for finance follow-through.";
    }

    if (role === "vendor") {
      return "Assigned account signals are ranked first so you can review scoped issues and escalate anything that needs internal action.";
    }

    if (role === "viewer" || role === "member") {
      return "High-signal oversight items are surfaced first so you can validate risk and route the right operators in.";
    }

    return "High-signal items are routed to the right operational surface.";
  }

  if (role === "finance_manager") {
    return "Billing, recovery, and revenue activity from your current workspace.";
  }

  if (role === "vendor") {
    return "Activity from the accounts and invoices assigned to your current vendor scope.";
  }

  if (role === "viewer" || role === "member") {
    return "Read-only workspace signals for monitoring health, ownership, and recent changes.";
  }

  return "High-signal activity from your current workspace.";
}

export function NotificationsMenu() {
  const { currentOrg } = useOrgStore();
  const { role } = usePermissions();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!currentOrg) {
      setEntries([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select("*, profile:profiles(full_name, avatar_url)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      setEntries([]);
      return;
    }

    setEntries((data ?? []) as ActivityEntry[]);
  }, [currentOrg]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const prioritizedEntries = [...entries].sort((left, right) => {
    const priorityDelta =
      getNotificationPriority(right, role) - getNotificationPriority(left, role);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return right.created_at.localeCompare(left.created_at);
  });

  const attentionEntries = prioritizedEntries.filter(isAttentionActivity).slice(0, 3);
  const recentEntries = prioritizedEntries
    .filter((entry) => !isAttentionActivity(entry))
    .slice(0, 5);
  const attentionCount = attentionEntries.length;
  const roleTitle = role ? ROLE_METADATA[role].title : "Workspace";

  const sections: ActionMenuSection[] = [];

  if (attentionEntries.length > 0) {
    sections.push({
      label: "Needs attention",
      items: attentionEntries.map((entry) => {
        const tone = getActivityTone(entry.action);

        return {
          label: getActivityHeadline(entry),
          description: `${entry.profile?.full_name ?? "System"} - ${timeAgo(entry.created_at)}`,
          href: getActivityDestination(entry, role),
          icon: getActivityIcon(entry.action),
          tone: tone === "danger" || tone === "warning" ? "danger" : "default",
        };
      }),
    });
  }

  if (recentEntries.length > 0) {
    sections.push({
      label: "Recent updates",
      items: recentEntries.map((entry) => ({
        label: getActivityHeadline(entry),
        description: `${entry.profile?.full_name ?? "System"} - ${timeAgo(entry.created_at)}`,
        href: getActivityDestination(entry, role),
        icon: getActivityIcon(entry.action),
      })),
    });
  }

  if (sections.length === 0) {
    sections.push({
      items: [
        {
          label: "No alerts right now",
          description: "Recent operational events will appear here.",
          icon: Clock3,
          disabled: true,
        },
      ],
    });
  }

  return (
    <ActionMenu
      sections={sections}
      widthClassName="w-80"
      triggerLabel="Open recent activity"
      header={
        <div className="px-1 pt-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              Notifications
            </p>
            {attentionCount > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {formatBadgeCount(attentionCount)} need review
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                Stable
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {roleTitle} notifications. {getNotificationsSummary(role, attentionCount)}
          </p>
        </div>
      }
      renderTrigger={() => (
        <span className="relative rounded-xl p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300">
          <Bell className="h-4 w-4" />
          {attentionCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {formatBadgeCount(attentionCount)}
            </span>
          ) : entries.length > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
          ) : null}
        </span>
      )}
    />
  );
}
