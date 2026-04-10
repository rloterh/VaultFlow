"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getActivityIcon,
  getActivityLabel,
  getActivitySubject,
  getActivityTone,
} from "@/lib/activity/presentation";
import { isCollectionsActivityAction } from "@/lib/invoices/follow-up";
import { buildWorkflowAccountabilityMap } from "@/lib/operations/accountability";
import { useOrgStore } from "@/stores/org-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface ActivityEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: { full_name: string | null; email: string | null };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ActivityPageContent() {
  const { currentOrg } = useOrgStore();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<
    "all" | "invoice" | "collections" | "workflow" | "client" | "member" | "billing"
  >("all");

  useEffect(() => {
    async function fetch() {
      if (!currentOrg) return;
      const sb = getSupabaseBrowserClient();
      const { data } = await sb
        .from("activity_log")
        .select("*, profile:profiles(full_name, email)")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEntries((data ?? []) as ActivityEntry[]);
      setLoading(false);
    }
    void fetch();
  }, [currentOrg]);

  const filteredEntries = entries.filter((entry) => {
    if (scope === "all") return true;
    if (scope === "collections") return isCollectionsActivityAction(entry.action);
    if (scope === "workflow") {
      return (
        entry.entity_type === "invoice" &&
        [
          "invoice.created",
          "invoice.reminder_sent",
          "invoice.sent",
          "invoice.viewed",
          "invoice.overdue",
          "invoice.paid",
          "invoice.cancelled",
        ].includes(entry.action)
      );
    }
    return entry.entity_type === scope;
  });

  const workflowAccountability = buildWorkflowAccountabilityMap(
    filteredEntries
      .filter((entry): entry is ActivityEntry & { entity_id: string } => Boolean(entry.entity_id))
      .map((entry) => ({
        entity_id: entry.entity_id,
        action: entry.action,
        created_at: entry.created_at,
        profile: entry.profile ? { full_name: entry.profile.full_name } : null,
      }))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          Activity log
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Recent actions across your organization.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "All activity", value: "all" as const },
          { label: "Invoices", value: "invoice" as const },
          { label: "Collections", value: "collections" as const },
          { label: "Workflow", value: "workflow" as const },
          { label: "Clients", value: "client" as const },
          { label: "Members", value: "member" as const },
          { label: "Billing", value: "billing" as const },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setScope(filter.value)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              scope === filter.value
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-2 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-500">
              No activity recorded for this view.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Try another filter or come back after the next operational action.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredEntries.map((entry) => {
              const Icon = getActivityIcon(entry.action);
              const label = getActivityLabel(entry.action);
              const color = getActivityTone(entry.action);
              const actorName =
                entry.profile?.full_name || entry.profile?.email || "System";
              const detail = getActivitySubject(entry);
              const accountability = workflowAccountability.get(entry.entity_id ?? "");

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <Icon className="h-3.5 w-3.5 text-neutral-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-900 dark:text-white">
                      <span className="font-medium">{actorName}</span>{" "}
                      <span className="text-neutral-500">{label.toLowerCase()}</span>
                      {detail && <span className="font-medium"> {detail}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {formatRelativeTime(entry.created_at)}
                    </p>
                    {entry.action === "invoice.reminder_sent" && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {typeof entry.metadata.reminder_stage === "string"
                          ? `${entry.metadata.reminder_stage.replace("-", " ")} follow-up`
                          : "Collections follow-up"}{" "}
                        {typeof entry.metadata.outstanding_balance === "number"
                          ? `· $${Math.round(entry.metadata.outstanding_balance).toLocaleString("en-US")} outstanding`
                          : ""}
                      </p>
                    )}
                    {scope === "workflow" && entry.entity_type === "invoice" && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {accountability?.ownerName
                          ? `Owner: ${accountability.ownerName}`
                          : "No workflow owner recorded yet"}
                        {accountability?.lastTouchedAt
                          ? ` · Last touch ${formatRelativeTime(accountability.lastTouchedAt)}`
                          : ""}
                      </p>
                    )}
                  </div>
                  {color && (
                    <Badge variant={color} className="mt-1 shrink-0 capitalize">
                      {scope === "collections" ? "collections" : scope === "workflow" ? "workflow" : entry.entity_type}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default function ActivityPage() {
  return (
    <AuthGuard minRole="manager">
      <ActivityPageContent />
    </AuthGuard>
  );
}
