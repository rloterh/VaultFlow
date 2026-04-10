"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  DollarSign,
  Download,
  Filter,
  TrendingUp,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { RevenueChart, StatusChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, Skeleton } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  buildCollectionsQueue,
  filterCollectionsQueue,
  formatLatestReminderStatus,
  formatQueuePriority,
  summarizeCollectionsQueue,
} from "@/lib/collections/queue";
import {
  canRecordReminder,
  getReminderEntryLabel,
  getReminderRecommendation,
  recordInvoiceReminder,
} from "@/lib/invoices/follow-up";
import {
  buildReportSnapshot,
  formatInvoiceStatus,
  type ReportFilters,
  type ReportInsight,
  type ReportRange,
} from "@/lib/reports/analytics";
import { exportInvoicesReport } from "@/lib/reports/export";
import {
  buildClientOpsViewHref,
  getClientOpsViewForQueuePreset,
} from "@/lib/operations/client-views";
import { buildWorkflowAccountabilityMap } from "@/lib/operations/accountability";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useInvoiceRealtime } from "@/lib/supabase/realtime";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import type { Client, Invoice, InvoiceStatus } from "@/types/database";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "all", label: "All time" },
];
const STATUS_OPTIONS: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];
const EMPTY_REPORT = buildReportSnapshot([], [], { range: "90d", status: "all" });

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function describeDueWindow(
  daysUntilDue: number,
  priority: "overdue" | "due-soon" | "open"
) {
  if (priority === "overdue") {
    const daysOverdue = Math.abs(daysUntilDue);
    return daysOverdue === 0
      ? "due today"
      : `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`;
  }

  if (priority === "due-soon") {
    return daysUntilDue === 0
      ? "due today"
      : `due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
  }

  return "open balance";
}

function InsightCard({ insight }: { insight: ReportInsight }) {
  const toneClassName = {
    neutral:
      "border-neutral-200/70 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/70",
    success:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    warning:
      "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20",
    danger:
      "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20",
  }[insight.tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {insight.title}
      </p>
      <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
        {insight.value}
      </p>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {insight.description}
      </p>
    </div>
  );
}

interface TopClientTooltipPayload {
  value: number;
}

function TopClientsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TopClientTooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <p className="mb-1 text-xs font-medium text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
        {fmt(payload[0].value)}
      </p>
    </div>
  );
}

interface ReminderActivityEntry {
  id: string;
  action: string;
  entity_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
  profile?: { full_name: string | null };
}

interface InvoiceWorkflowActivityEntry {
  entity_id: string;
  action: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

function formatRelativeTime(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ReportsContent() {
  const { user } = useAuth();
  const { currentOrg } = useOrgStore();
  const { can, role } = usePermissions();
  const addToast = useUIStore((state) => state.addToast);
  const queuePreset = useUIStore((state) => state.collectionsPreset);
  const setQueuePreset = useUIStore((state) => state.setCollectionsPreset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reminders, setReminders] = useState<ReminderActivityEntry[]>([]);
  const [workflowActivity, setWorkflowActivity] = useState<
    InvoiceWorkflowActivityEntry[]
  >([]);
  const [reminderInvoiceId, setReminderInvoiceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    range: "90d",
    status: "all",
  });

  const fetchReports = useCallback(async () => {
    if (!currentOrg) return;

    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const [invoiceResponse, clientResponse, reminderResponse, activityResponse] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, client:clients(id, name, company)")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("*")
        .eq("org_id", currentOrg.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("id, action, entity_id, created_at, metadata, profile:profiles(full_name)")
        .eq("org_id", currentOrg.id)
        .eq("entity_type", "invoice")
        .eq("action", "invoice.reminder_sent")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("activity_log")
        .select("entity_id, action, created_at, profile:profiles(full_name, avatar_url)")
        .eq("org_id", currentOrg.id)
        .eq("entity_type", "invoice")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    if (invoiceResponse.error || clientResponse.error || reminderResponse.error || activityResponse.error) {
      const message =
        invoiceResponse.error?.message ??
        clientResponse.error?.message ??
        reminderResponse.error?.message ??
        activityResponse.error?.message ??
        "Unable to load reports.";
      setError(message);
      setLoading(false);
      addToast({
        type: "error",
        title: "Reports unavailable",
        description: message,
      });
      return;
    }

    setInvoices((invoiceResponse.data ?? []) as Invoice[]);
    setClients((clientResponse.data ?? []) as Client[]);
    setReminders((reminderResponse.data ?? []) as ReminderActivityEntry[]);
    setWorkflowActivity((activityResponse.data ?? []) as InvoiceWorkflowActivityEntry[]);
    setLoading(false);
  }, [addToast, currentOrg]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useInvoiceRealtime(currentOrg?.id, fetchReports);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queue = new URLSearchParams(window.location.search).get("queue");
    if (
      queue &&
      ["all", "needs-touch", "overdue", "unreminded"].includes(queue) &&
      queue !== queuePreset
    ) {
      setQueuePreset(queue as typeof queuePreset);
    }
  }, [queuePreset, setQueuePreset]);

  function handleFilterChange<K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleExport() {
    if (!can("reports:export")) return;

    exportInvoicesReport(
      report.invoices,
      clients,
      `vaultflow-${filters.range}-${filters.status}-report.csv`
    );
    addToast({
      type: "success",
      title: "Report exported",
      description: `Downloaded ${report.invoices.length} invoice${report.invoices.length === 1 ? "" : "s"} from the current view.`,
    });
  }

  async function handleRecordReminder(invoice: Invoice) {
    setReminderInvoiceId(invoice.id);
    const success = await recordInvoiceReminder(invoice, user?.id);

    if (!success) {
      addToast({
        type: "error",
        title: "Reminder could not be recorded",
        description: "Try again after the activity log reconnects.",
      });
      setReminderInvoiceId(null);
      return;
    }

    await fetchReports();
    addToast({
      type: "success",
      title: "Reminder recorded",
      description: `A follow-up touchpoint was logged for ${invoice.invoice_number}.`,
    });
    setReminderInvoiceId(null);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Reports are temporarily unavailable"
          description={error}
          actionLabel="Retry"
          onAction={fetchReports}
        />
      </Card>
    );
  }

  const report =
    invoices.length === 0 && clients.length === 0
      ? EMPTY_REPORT
      : buildReportSnapshot(invoices, clients, filters);
  const summary = report.summary;
  const reminderLookup = new Map<string, ReminderActivityEntry>();
  const collectionsQueue = buildCollectionsQueue(report.invoices, reminders);
  const queueSummary = summarizeCollectionsQueue(collectionsQueue);
  const visibleQueue = filterCollectionsQueue(collectionsQueue, queuePreset);
  const matchingClientViewHref = buildClientOpsViewHref(
    getClientOpsViewForQueuePreset(queuePreset)
  );
  const accountabilityByInvoiceId = buildWorkflowAccountabilityMap(workflowActivity);

  reminders.forEach((entry) => {
    if (!reminderLookup.has(entry.entity_id)) {
      reminderLookup.set(entry.entity_id, entry);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Reports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            A live operational view of collections, invoice throughput, and
            account exposure across your workspace.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm text-neutral-500">
              <span className="flex items-center gap-2 font-medium text-neutral-600 dark:text-neutral-300">
                <Filter className="h-4 w-4" />
                Window
              </span>
              <select
                value={filters.range}
                onChange={(event) =>
                  handleFilterChange("range", event.target.value as ReportRange)
                }
                className="h-10 min-w-[160px] rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-400"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-neutral-500">
              <span className="font-medium text-neutral-600 dark:text-neutral-300">
                Status
              </span>
              <select
                value={filters.status}
                onChange={(event) =>
                  handleFilterChange(
                    "status",
                    event.target.value as ReportFilters["status"]
                  )
                }
                className="h-10 min-w-[160px] rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-400"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {can("reports:export") ? (
            <Button
              variant="outline"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handleExport}
              disabled={report.invoices.length === 0}
            >
              Export CSV
            </Button>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              {role === "manager"
                ? "Export is reserved for admins and owners."
                : "You can review the workspace analytics in read-only mode."}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Collected Revenue"
          value={fmt(summary.collectedRevenue)}
          icon={DollarSign}
          iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          index={0}
        />
        <MetricCard
          label="Open Balance"
          value={fmt(summary.outstandingBalance)}
          icon={TrendingUp}
          iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          index={1}
        />
        <MetricCard
          label="Invoices in View"
          value={String(summary.totalInvoices)}
          icon={BarChart3}
          iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          index={2}
        />
        <MetricCard
          label="Collection Rate"
          value={`${summary.collectionRate}%`}
          icon={Users}
          iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
          index={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {report.insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {report.invoices.length === 0 ? (
        <Card>
          <EmptyState
            title="No invoices match these filters"
            description="Adjust the reporting window or choose a different status to bring records into view."
            actionLabel="Reset filters"
            onAction={() => setFilters({ range: "90d", status: "all" })}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="mb-0">
              <CardTitle>Revenue trend</CardTitle>
              <CardDescription>
                Collected revenue over the selected reporting window.
              </CardDescription>
            </CardHeader>
            <div className="mt-4">
              <RevenueChart data={report.revenueData} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="mb-0">
                <CardTitle>Invoice status breakdown</CardTitle>
                <CardDescription>
                  Use this to spot whether the team is shipping work forward or
                  letting receivables stall.
                </CardDescription>
              </CardHeader>
              <div className="mt-4">
                {report.statusData.length > 0 ? (
                  <StatusChart data={report.statusData} />
                ) : (
                  <p className="py-8 text-center text-sm text-neutral-400">
                    No data
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader className="mb-0">
                <CardTitle>Top clients in this view</CardTitle>
                <CardDescription>
                  Highest billed accounts within the current report filter set.
                </CardDescription>
              </CardHeader>
              <div className="mt-4">
                {report.topClients.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={report.topClients}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border-tertiary, #e5e5e5)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#a3a3a3" }}
                        tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#737373" }}
                        width={100}
                      />
                      <Tooltip content={<TopClientsTooltip />} />
                      <Bar
                        dataKey="total_revenue"
                        radius={[0, 4, 4, 0]}
                        animationDuration={800}
                      >
                        {report.topClients.map((client, index) => (
                          <Cell
                            key={client.id}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-neutral-400">
                    No client data
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="mb-0">
                <CardTitle>Attention queue</CardTitle>
                <CardDescription>
                  The invoices most likely to need follow-up next.
                </CardDescription>
              </CardHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Needs touch", value: "needs-touch" as const, count: queueSummary.needsTouch },
                    { label: "Overdue", value: "overdue" as const, count: queueSummary.overdue },
                    { label: "Unreminded", value: "unreminded" as const, count: queueSummary.unreminded },
                    { label: "All open", value: "all" as const, count: queueSummary.openInvoices },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setQueuePreset(preset.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        queuePreset === preset.value
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {preset.label} ({preset.count})
                    </button>
                  ))}
                </div>
                <Link
                  href={matchingClientViewHref}
                  className="inline-flex text-sm font-medium text-neutral-900 dark:text-white"
                >
                  Open matching client view
                </Link>
                {visibleQueue.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">
                    No open receivables are showing up for this queue preset.
                  </p>
                ) : (
                  visibleQueue.map((item) => (
                    <div
                      key={item.invoice.id}
                      className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                              {item.invoice.invoice_number}
                            </p>
                            <StatusBadge status={item.invoice.status} />
                            <Badge
                              variant={
                                item.priority === "critical"
                                  ? "danger"
                                  : item.priority === "high"
                                    ? "warning"
                                    : "outline"
                              }
                            >
                              {formatQueuePriority(item.priority)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                            {item.invoice.client?.name ?? "Unknown client"} &middot;{" "}
                            {describeDueWindow(item.daysUntilDue, item.invoice.status === "overdue" ? "overdue" : item.daysUntilDue <= 7 ? "due-soon" : "open")}
                          </p>
                          <p className="mt-2 text-xs text-neutral-400">
                            {getReminderRecommendation(item.invoice)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {fmt(item.outstandingAmount)}
                          </p>
                          <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                            Outstanding
                          </p>
                        </div>
                      </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                        <div className="space-y-1 text-xs text-neutral-400">
                          <p>
                            {reminderLookup.has(item.invoice.id)
                              ? `${getReminderEntryLabel(reminderLookup.get(item.invoice.id) ?? null)} ${formatRelativeTime(reminderLookup.get(item.invoice.id)?.created_at ?? "")}`
                              : formatLatestReminderStatus(item)}
                          </p>
                          <p>
                            {accountabilityByInvoiceId.get(item.invoice.id)?.ownerName
                              ? `Owned by ${accountabilityByInvoiceId.get(item.invoice.id)?.ownerName}`
                              : "No workflow owner recorded yet"}
                            {accountabilityByInvoiceId.get(item.invoice.id)?.lastTouchedAt
                              ? ` · Last touch ${formatRelativeTime(accountabilityByInvoiceId.get(item.invoice.id)?.lastTouchedAt ?? "")}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {can("invoices:update") && canRecordReminder(item.invoice) && (
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={reminderInvoiceId === item.invoice.id}
                              leftIcon={<BellRing className="h-4 w-4" />}
                              onClick={() => handleRecordReminder(item.invoice)}
                            >
                              Record reminder
                            </Button>
                          )}
                          <Link href={`/dashboard/invoices/${item.invoice.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}
                            >
                              View invoice
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <CardHeader className="mb-0">
                <CardTitle>Filter snapshot</CardTitle>
                <CardDescription>
                  A compact read on what the current reporting slice is
                  capturing.
                </CardDescription>
              </CardHeader>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Active filters
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      {
                        RANGE_OPTIONS.find(
                          (option) => option.value === filters.range
                        )?.label
                      }
                    </span>
                    <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      {filters.status === "all"
                        ? "All statuses"
                        : formatInvoiceStatus(filters.status)}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      Overdue exposure
                    </p>
                    <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                      {fmt(summary.overdueAmount)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {summary.overdueCount} overdue invoice
                      {summary.overdueCount === 1 ? "" : "s"} in this view.
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      Avg. invoice value
                    </p>
                    <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                      {fmt(summary.averageInvoiceValue)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      Based on all non-cancelled invoices within the current
                      filter set.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard permission="reports:read">
      <ReportsContent />
    </AuthGuard>
  );
}
