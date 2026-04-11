"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, CreditCard, Shield } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getActivityIcon,
  getActivityLabel,
  getActivitySubject,
  getActivityTone,
} from "@/lib/activity/presentation";
import {
  isBillingControlActivityAction,
  isGovernanceActivityAction,
} from "@/lib/admin/governance";
import { isCollectionsActivityAction } from "@/lib/invoices/follow-up";
import { buildWorkflowAccountabilityMap } from "@/lib/operations/accountability";
import { useOrgStore } from "@/stores/org-store";

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

type ActivityScope =
  | "all"
  | "invoice"
  | "collections"
  | "workflow"
  | "client"
  | "member"
  | "billing"
  | "governance";

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

function isWorkflowAction(action: string) {
  return [
    "invoice.created",
    "invoice.reminder_sent",
    "invoice.sent",
    "invoice.viewed",
    "invoice.overdue",
    "invoice.paid",
    "invoice.cancelled",
    "invoice.recovery_reviewed",
    "payment_refund_requested",
    "invoice.credit_requested",
    "invoice.void_requested",
  ].includes(action);
}

function getActivityRoleDescription(role: ReturnType<typeof usePermissions>["role"]) {
  if (role === "finance_manager") {
    return "Review billing exceptions, recovery reviews, and invoice workflow events without leaving the finance operating lane.";
  }

  if (role === "admin" || role === "owner") {
    return "Review workflow, billing, and governance actions across the organization with access-management context included.";
  }

  return "Review workflow, billing, and governance actions across your organization.";
}

function getActivityRoleBadge(role: ReturnType<typeof usePermissions>["role"]) {
  if (role === "finance_manager") {
    return "Finance audit";
  }

  if (role === "admin" || role === "owner") {
    return "Control plane";
  }

  return "Operational audit";
}

function getEmptyActivityCopy(
  role: ReturnType<typeof usePermissions>["role"],
  scope: ActivityScope
) {
  if (role === "finance_manager" && (scope === "billing" || scope === "collections")) {
    return "No finance-side events are currently recorded for this scope. Try a broader filter or check back after the next billing action.";
  }

  if ((role === "admin" || role === "owner") && scope === "governance") {
    return "No governance changes are recorded for this view. Try another scope or return after the next control-plane action.";
  }

  return "Try another filter or come back after the next operational action.";
}

function ActivityPageContent() {
  const { currentOrg } = useOrgStore();
  const { role, can } = usePermissions();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ActivityScope>("all");

  useEffect(() => {
    async function fetch() {
      if (!currentOrg) return;
      const sb = getSupabaseBrowserClient();
      const { data } = await sb
        .from("activity_log")
        .select("*, profile:profiles(full_name, email)")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setEntries((data ?? []) as ActivityEntry[]);
      setLoading(false);
    }
    void fetch();
  }, [currentOrg]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (scope === "all") return true;
        if (scope === "collections") return isCollectionsActivityAction(entry.action);
        if (scope === "workflow") {
          return entry.entity_type === "invoice" && isWorkflowAction(entry.action);
        }
        if (scope === "billing") {
          return isBillingControlActivityAction(entry.action, entry.entity_type);
        }
        if (scope === "governance") {
          return isGovernanceActivityAction(entry.action, entry.entity_type);
        }
        return entry.entity_type === scope;
      }),
    [entries, scope]
  );

  const workflowAccountability = useMemo(
    () =>
      buildWorkflowAccountabilityMap(
        filteredEntries
          .filter((entry): entry is ActivityEntry & { entity_id: string } => Boolean(entry.entity_id))
          .map((entry) => ({
            entity_id: entry.entity_id,
            action: entry.action,
            created_at: entry.created_at,
            profile: entry.profile ? { full_name: entry.profile.full_name } : null,
          }))
      ),
    [filteredEntries]
  );

  const summaryCards = useMemo(() => {
    const last14Days = Date.now() - 1000 * 60 * 60 * 24 * 14;
    const recentEntries = entries.filter(
      (entry) => new Date(entry.created_at).getTime() >= last14Days
    );
    const governanceCount = recentEntries.filter((entry) =>
      isGovernanceActivityAction(entry.action, entry.entity_type)
    ).length;
    const billingExceptions = recentEntries.filter((entry) =>
      ["payment_failed", "subscription_cancelled", "invoice.voided"].includes(entry.action)
    ).length;
    const recoveryReviews = recentEntries.filter(
      (entry) => entry.action === "invoice.recovery_reviewed"
    ).length;
    const privilegeChanges = recentEntries.filter((entry) =>
      ["member.role_changed", "member.removed"].includes(entry.action)
    ).length;

    return [
      {
        label: "Governance actions",
        value: String(governanceCount),
        detail: "Role, invite, and org-setting events in the last 14 days.",
        icon: Shield,
      },
      {
        label: "Billing exceptions",
        value: String(billingExceptions),
        detail: "Failures, cancellations, or void activity worth audit review.",
        icon: AlertTriangle,
      },
      {
        label: "Recovery reviews",
        value: String(recoveryReviews),
        detail: "Invoice recovery reviews logged during the same audit window.",
        icon: CreditCard,
      },
      {
        label: "Privileged changes",
        value: String(privilegeChanges),
        detail: "Member removals and role shifts that changed access posture.",
        icon: Activity,
      },
    ];
  }, [entries]);

  const scopeFilters: Array<{ label: string; value: ActivityScope }> = [
    { label: "All activity", value: "all" },
    { label: "Invoices", value: "invoice" },
    { label: "Collections", value: "collections" },
    { label: "Workflow", value: "workflow" },
    { label: "Clients", value: "client" },
    { label: "Members", value: "member" },
    { label: "Billing", value: "billing" },
    { label: "Governance", value: "governance" },
  ];

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
          {getActivityRoleDescription(role)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{getActivityRoleBadge(role)}</Badge>
          {can("org:billing") ? (
            <Link
              href="/settings/billing"
              className="text-xs font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
            >
              Open billing controls
            </Link>
          ) : null}
          {role === "admin" || role === "owner" ? (
            <Link
              href="/dashboard/admin"
              className="text-xs font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
            >
              Open admin overview
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-neutral-500" />
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {card.label}
                </p>
              </div>
              <p className="mt-4 text-2xl font-semibold text-neutral-900 dark:text-white">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-neutral-500">{card.detail}</p>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {scopeFilters.map((filter) => (
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

      <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
        {role === "finance_manager"
          ? "Finance focus: billing exceptions and recovery reviews usually carry the most signal for this role."
          : role === "admin" || role === "owner"
            ? "Control-plane focus: governance and privileged changes are included alongside the billing and workflow timeline."
            : "Workflow focus: use the scope chips to narrow the operating timeline to the events that matter most right now."}
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
              {getEmptyActivityCopy(role, scope)}
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
                          : "Collections follow-up"}
                        {typeof entry.metadata.outstanding_balance === "number"
                          ? ` - $${Math.round(entry.metadata.outstanding_balance).toLocaleString("en-US")} outstanding`
                          : ""}
                      </p>
                    )}
                    {scope === "workflow" && entry.entity_type === "invoice" && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {accountability?.ownerName
                          ? `Owner: ${accountability.ownerName}`
                          : "No workflow owner recorded yet"}
                        {accountability?.lastTouchedAt
                          ? ` - Last touch ${formatRelativeTime(accountability.lastTouchedAt)}`
                          : ""}
                      </p>
                    )}
                  </div>
                  {color && (
                    <Badge variant={color} className="mt-1 shrink-0 capitalize">
                      {scope === "collections"
                        ? "collections"
                        : scope === "workflow"
                          ? "workflow"
                          : scope === "governance"
                            ? "governance"
                            : entry.entity_type}
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
