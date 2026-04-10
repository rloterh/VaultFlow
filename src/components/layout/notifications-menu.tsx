"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Clock3 } from "lucide-react";
import { ActionMenu, type ActionMenuSection } from "@/components/ui/action-menu";
import { getActivityHeadline } from "@/lib/activity/presentation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import type { ActivityEntry } from "@/types/database";

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationsMenu() {
  const { currentOrg } = useOrgStore();
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
      .limit(5);

    if (error) {
      setEntries([]);
      return;
    }

    setEntries((data ?? []) as ActivityEntry[]);
  }, [currentOrg]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const sections: ActionMenuSection[] =
    entries.length > 0
      ? [
          {
            label: "Recent activity",
            items: entries.map((entry) => ({
              label: getActivityHeadline(entry),
              description: `${entry.profile?.full_name ?? "System"} - ${timeAgo(entry.created_at)}`,
              href: "/dashboard/activity",
              icon: Clock3,
            })),
          },
        ]
      : [
          {
            items: [
              {
                label: "No alerts right now",
                description: "Recent operational events will appear here.",
                icon: Clock3,
                disabled: true,
              },
            ],
          },
        ];

  return (
    <ActionMenu
      sections={sections}
      widthClassName="w-80"
      triggerLabel="Open recent activity"
      header={
        <div className="px-1 pt-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            Notifications
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            High-signal activity from your current workspace.
          </p>
        </div>
      }
      renderTrigger={() => (
        <span className="relative rounded-xl p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300">
          <Bell className="h-4 w-4" />
          {entries.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </span>
      )}
    />
  );
}
