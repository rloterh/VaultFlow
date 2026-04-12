"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  BellRing,
  BriefcaseBusiness,
  DollarSign, FileText, Users, TrendingUp,
  Plus, ArrowUpRight, Clock, LayoutList, LineChart,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Badge, Skeleton } from "@/components/ui/badge";
import { RevenueChart, StatusChart } from "@/components/charts";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { getActivityLabel, getActivitySubject } from "@/lib/activity/presentation";
import {
  buildCollectionsQueue,
  filterCollectionsQueue,
  formatLatestReminderStatus,
  formatQueuePriority,
  summarizeCollectionsQueue,
  type ReminderActivityLike,
} from "@/lib/collections/queue";
import {
  buildClientInsightMap,
  rankClientAccounts,
} from "@/lib/clients/insights";
import {
  canRecordReminder,
  recordInvoiceReminder,
} from "@/lib/invoices/follow-up";
import {
  buildClientOpsViewHref,
  getClientOpsViewForQueuePreset,
} from "@/lib/operations/client-views";
import { buildOperatorHandoff } from "@/lib/operations/daily-handoff";
import {
  buildClientWorkspaceHref,
  buildBillingRecoveryPresetHref,
  buildReportPresetHref,
} from "@/lib/operations/launchpad";
import {
  buildWorkflowAccountabilityMap,
  summarizeQueueAccountability,
} from "@/lib/operations/accountability";
import { buildDashboardIntelligenceSnapshot } from "@/lib/operations/dashboard-intelligence";
import { buildReportSnapshot } from "@/lib/reports/analytics";
import {
  fetchVendorAssignedClientIds,
  isVendorRole,
} from "@/lib/rbac/vendor-access";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import { useInvoiceRealtime } from "@/lib/supabase/realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActivityEntry, Client, DashboardStats, Invoice, RevenueDataPoint, StatusDistribution } from "@/types/database";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const permissions = usePermissions();
  const { currentOrg } = useOrgStore();
  const addToast = useUIStore((s) => s.addToast);
  const queuePreset = useUIStore((s) => s.collectionsPreset);
  const setQueuePreset = useUIStore((s) => s.setCollectionsPreset);
  const savedClientWorkspaceViews = useUIStore((s) => s.savedClientWorkspaceViews);
  const savedReportPresets = useUIStore((s) => s.savedReportPresets);
  const savedBillingRecoveryPresets = useUIStore((s) => s.savedBillingRecoveryPresets);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDistribution[]>([]);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reminders, setReminders] = useState<ReminderActivityLike[]>([]);
  const [workflowActivity, setWorkflowActivity] = useState<
    Array<{
      entity_id: string;
      action: string;
      created_at: string;
      profile?: { full_name: string | null; avatar_url: string | null } | null;
    }>
  >([]);
  const [reminderInvoiceId, setReminderInvoiceId] = useState<string | null>(null);
  const [operationsPulse, setOperationsPulse] = useState(() =>
    buildReportSnapshot([], [], { range: "90d", status: "all" })
  );
  const isVendorDashboard = isVendorRole(permissions.role);
  const isViewerDashboard = permissions.role === "viewer";

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    const sb = getSupabaseBrowserClient();
    const assignedClientIds = isVendorDashboard
      ? await fetchVendorAssignedClientIds(sb, currentOrg.id, user?.id)
      : [];

    if (isVendorDashboard && assignedClientIds.length === 0) {
      setInvoices([]);
      setClients([]);
      setRecent([]);
      setActivity([]);
      setReminders([]);
      setWorkflowActivity([]);
      setStats({
        totalRevenue: 0,
        revenueChange: 0,
        invoicesSent: 0,
        invoicesChange: 0,
        activeClients: 0,
        clientsChange: 0,
        overdueAmount: 0,
        overdueChange: 0,
      });
      setRevenueData([]);
      setStatusData([]);
      setOperationsPulse(buildReportSnapshot([], [], { range: "90d", status: "all" }));
      setLoading(false);
      return;
    }

    let invoiceQuery = sb
      .from("invoices")
      .select("*, client:clients(id, name, company)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    let clientQuery = sb
      .from("clients")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("is_active", true);

    if (isVendorDashboard) {
      invoiceQuery = invoiceQuery.in("client_id", assignedClientIds);
      clientQuery = clientQuery.in("id", assignedClientIds);
    }

    const [invRes, cliRes] = await Promise.all([invoiceQuery, clientQuery]);
    const invoices = (invRes.data ?? []) as Invoice[];
    const clients = (cliRes.data ?? []) as Client[];
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const [actRes, reminderRes, workflowRes] =
      invoiceIds.length > 0
        ? await Promise.all([
            sb
              .from("activity_log")
              .select("*, profile:profiles(full_name, avatar_url)")
              .eq("org_id", currentOrg.id)
              .eq("entity_type", "invoice")
              .in("entity_id", invoiceIds)
              .order("created_at", { ascending: false })
              .limit(8),
            sb
              .from("activity_log")
              .select("entity_id, created_at, metadata")
              .eq("org_id", currentOrg.id)
              .eq("entity_type", "invoice")
              .eq("action", "invoice.reminder_sent")
              .in("entity_id", invoiceIds)
              .order("created_at", { ascending: false })
              .limit(100),
            sb
              .from("activity_log")
              .select("entity_id, action, created_at, profile:profiles(full_name, avatar_url)")
              .eq("org_id", currentOrg.id)
              .eq("entity_type", "invoice")
              .in("entity_id", invoiceIds)
              .order("created_at", { ascending: false })
              .limit(300),
          ])
        : [
            { data: [] as ActivityEntry[] },
            { data: [] as ReminderActivityLike[] },
            {
              data: [] as Array<{
                entity_id: string;
                action: string;
                created_at: string;
                profile?: { full_name: string | null; avatar_url: string | null } | null;
              }>,
            },
          ];
    setInvoices(invoices);
    setClients(clients);
    setReminders((reminderRes.data ?? []) as ReminderActivityLike[]);
    setWorkflowActivity(
      (workflowRes.data ?? []) as Array<{
        entity_id: string;
        action: string;
        created_at: string;
        profile?: { full_name: string | null; avatar_url: string | null } | null;
      }>
    );
    setRecent(invoices.slice(0, 5));
    setActivity((actRes.data ?? []) as ActivityEntry[]);

    const paid = invoices.filter(i => i.status === "paid");
    const totalRev = paid.reduce((s, i) => s + Number(i.total), 0);
    const overdue = invoices.filter(i => i.status === "overdue");
    const overdueAmt = overdue.reduce((s, i) => s + Number(i.total), 0);
    setStats({
      totalRevenue: totalRev, revenueChange: 20.1,
      invoicesSent: invoices.filter(i => i.status !== "draft").length, invoicesChange: 12,
      activeClients: clients.length, clientsChange: 3,
      overdueAmount: overdueAmt, overdueChange: -4.3,
    });
    setOperationsPulse(buildReportSnapshot(invoices, clients, { range: "90d", status: "all" }));

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const chart: RevenueDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mi = paid.filter((inv) => { const id = new Date(inv.issue_date); return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear(); });
      chart.push({ month: months[d.getMonth()], revenue: mi.reduce((s, inv) => s + Number(inv.total), 0), invoices: mi.length });
    }
    setRevenueData(chart);

    const smap = new Map<string, { count: number; amount: number }>();
    invoices.forEach(inv => { const e = smap.get(inv.status) ?? { count: 0, amount: 0 }; e.count++; e.amount += Number(inv.total); smap.set(inv.status, e); });
    setStatusData(
      Array.from(smap.entries()).map(([currentStatus, d]) => ({
        status: currentStatus as Invoice["status"],
        count: d.count,
        amount: d.amount,
      }))
    );
    setLoading(false);
  }, [currentOrg, isVendorDashboard, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useInvoiceRealtime(currentOrg?.id, fetchData);

  const name = profile?.full_name?.split(" ")[0] || "there";
  const primaryAction = isVendorDashboard
    ? {
        href: "/dashboard/clients",
        label: "Open assigned accounts",
        icon: <ArrowUpRight className="h-4 w-4" />,
      }
    : permissions.can("invoices:create")
    ? {
        href: "/dashboard/invoices",
        label: "New invoice",
        icon: <Plus className="h-4 w-4" />,
      }
    : {
        href: "/dashboard/reports",
        label: "Open reports",
        icon: <ArrowUpRight className="h-4 w-4" />,
      };
  const canOpenReportsWorkspace = permissions.can("reports:read");
  const canOpenBillingWorkspace = permissions.can("org:billing");
  const launchpadPrimaryLink = isVendorDashboard
    ? {
        href: "/dashboard/clients",
        label: "Open assigned client workspace",
      }
    : canOpenReportsWorkspace
      ? {
          href: "/dashboard/reports",
          label: "Open full reporting workspace",
        }
      : {
          href: "/dashboard/invoices",
          label: "Open invoice workspace",
        };
  const launchpadDescription = isVendorDashboard
    ? "Jump straight into the assigned-client and invoice surfaces your vendor seat can safely use without rebuilding context."
    : permissions.role === "viewer" || permissions.role === "member"
      ? "Reopen saved oversight workspaces for client and reporting review without stepping into mutation-only billing paths."
      : "Jump straight into the client, reporting, and billing slices your team uses most often. These links preserve the saved state you built in Phase 5.";
  const workspaceShortcuts = isVendorDashboard
    ? [
        {
          title: "Assigned invoices",
          href: "/dashboard/invoices",
          description: "Review the invoice portfolio scoped to your vendor seat.",
        },
        {
          title: "Assigned clients",
          href: "/dashboard/clients",
          description: "Open the client workspace with your assignment-backed visibility.",
        },
      ]
    : permissions.role === "viewer" || permissions.role === "member"
      ? [
          {
            title: "Invoice oversight",
            href: "/dashboard/invoices",
            description: "Review invoice posture without opening operator-only billing controls.",
          },
          {
            title: "Client oversight",
            href: "/dashboard/clients",
            description: "Validate account health, ownership, and recent activity in context.",
          },
        ]
      : canOpenBillingWorkspace
        ? []
        : [
            {
              title: "Invoice workspace",
              href: "/dashboard/invoices",
              description: "Open the active invoice lane alongside your saved workspaces.",
            },
            {
              title: "Client workspace",
              href: "/dashboard/clients",
              description: "Review account-level posture without switching contexts manually.",
            },
          ];
  const biggestExposure = operationsPulse.topClients[0];
  const collectionsQueue = useMemo(
    () => buildCollectionsQueue(invoices, reminders),
    [invoices, reminders]
  );
  const queueSummary = useMemo(
    () => summarizeCollectionsQueue(collectionsQueue),
    [collectionsQueue]
  );
  const accountabilityByInvoiceId = useMemo(
    () => buildWorkflowAccountabilityMap(workflowActivity),
    [workflowActivity]
  );
  const accountabilitySummary = useMemo(
    () => summarizeQueueAccountability(collectionsQueue, accountabilityByInvoiceId),
    [accountabilityByInvoiceId, collectionsQueue]
  );
  const queueClientOpsHref = useMemo(
    () => buildClientOpsViewHref(getClientOpsViewForQueuePreset(queuePreset)),
    [queuePreset]
  );
  const visibleQueue = useMemo(
    () => filterCollectionsQueue(collectionsQueue, queuePreset).slice(0, 4),
    [collectionsQueue, queuePreset]
  );
  const clientRiskRanking = useMemo(() => {
    const insightMap = buildClientInsightMap(invoices);
    return rankClientAccounts(clients, insightMap).slice(0, 4);
  }, [clients, invoices]);
  const clientLaunchViews = useMemo(
    () =>
      savedClientWorkspaceViews
        .filter((view) => view.orgId === currentOrg?.id)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 2),
    [currentOrg?.id, savedClientWorkspaceViews]
  );
  const reportLaunchViews = useMemo(
    () =>
      savedReportPresets
        .filter((preset) => preset.orgId === currentOrg?.id)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 2),
    [currentOrg?.id, savedReportPresets]
  );
  const billingLaunchViews = useMemo(
    () =>
      savedBillingRecoveryPresets
        .filter((preset) => preset.orgId === currentOrg?.id)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 2),
    [currentOrg?.id, savedBillingRecoveryPresets]
  );
  const operatorHandoff = useMemo(
    () =>
      buildOperatorHandoff({
        role: permissions.role,
        queue: queueSummary,
        accountability: accountabilitySummary,
        reportSummary: operationsPulse.summary,
        savedClientViews: clientLaunchViews,
        savedReportPresets: reportLaunchViews,
        savedBillingPresets: billingLaunchViews,
      }),
    [
        accountabilitySummary,
        billingLaunchViews,
        clientLaunchViews,
        operationsPulse.summary,
        permissions.role,
        queueSummary,
        reportLaunchViews,
      ]
    );
  const intelligenceSnapshot = useMemo(
    () =>
      buildDashboardIntelligenceSnapshot({
        invoices,
        clients,
        activity,
        scopeLabel: isVendorDashboard ? "assigned portfolio" : "workspace",
      }),
    [activity, clients, invoices, isVendorDashboard]
  );

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

    await fetchData();
    addToast({
      type: "success",
      title: "Reminder recorded",
      description: `A follow-up touchpoint was logged for ${invoice.invoice_number}.`,
    });
    setReminderInvoiceId(null);
  }

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Good morning, {name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isVendorDashboard
              ? "Here is the current posture across the accounts assigned to your vendor seat."
              : isViewerDashboard
                ? "Here&apos;s the current read-only pulse across your workspace."
                : "Here&apos;s what&apos;s happening with your finances today."}
          </p>
        </div>
        <Link href={primaryAction.href}><Button leftIcon={primaryAction.icon}>{primaryAction.label}</Button></Link>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Daily handoff
              </p>
              <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
                {operatorHandoff.title}
              </p>
              <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                {operatorHandoff.detail}
              </p>
            </div>
            <Link href="/dashboard/invoices" className="inline-flex text-sm font-medium text-neutral-900 dark:text-white">
              Open invoice workspace
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {operatorHandoff.actions.map((action) => (
              <Link
                key={`${action.category}-${action.href}`}
                href={action.href}
                className="rounded-xl border border-neutral-200/70 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline">{action.category}</Badge>
                    <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {action.detail}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-neutral-400" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Operator launchpad
              </p>
                <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
                  Reopen saved workspaces without rebuilding context
                </p>
                <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                  {launchpadDescription}
                </p>
              </div>
              <Link href={launchpadPrimaryLink.href} className="inline-flex text-sm font-medium text-neutral-900 dark:text-white">
                {launchpadPrimaryLink.label}
              </Link>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-neutral-500" />
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Client workspaces
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {clientLaunchViews.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Save a client workspace view to pin it here for faster collections and account review.
                  </p>
                  ) : (
                    clientLaunchViews.map((view) => (
                    <Link
                      key={view.id}
                      href={buildClientWorkspaceHref(view)}
                      className="flex items-start justify-between gap-3 rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {view.label}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {view.health === "all" ? "all health" : view.health} | {view.queuePreset} | {view.touchFilter === "all" ? "all touchpoints" : view.touchFilter}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 text-neutral-400" />
                    </Link>
                  ))
                  )}
                </div>
              </div>

              {canOpenReportsWorkspace ? (
                <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-neutral-500" />
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      Report presets
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {reportLaunchViews.length === 0 ? (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Save a report preset to pin a recurring analytics view here.
                      </p>
                    ) : (
                      reportLaunchViews.map((preset) => (
                        <Link
                          key={preset.id}
                          href={buildReportPresetHref({
                            range: preset.range,
                            status: preset.status,
                          })}
                          className="flex items-start justify-between gap-3 rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                        >
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {preset.label}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {preset.range} | {preset.status === "all" ? "all statuses" : preset.status}
                            </p>
                          </div>
                          <ArrowUpRight className="mt-0.5 h-4 w-4 text-neutral-400" />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {canOpenBillingWorkspace ? (
                <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-neutral-500" />
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      Billing recovery
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {billingLaunchViews.length === 0 ? (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Save a billing recovery preset to pin finance handoff queues here.
                      </p>
                    ) : (
                      billingLaunchViews.map((preset) => (
                        <Link
                          key={preset.id}
                          href={buildBillingRecoveryPresetHref(preset.preset)}
                          className="flex items-start justify-between gap-3 rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                        >
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {preset.label}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {preset.preset} recovery queue
                            </p>
                          </div>
                          <ArrowUpRight className="mt-0.5 h-4 w-4 text-neutral-400" />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {workspaceShortcuts.length > 0 ? (
                <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-neutral-500" />
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      Workspace shortcuts
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {workspaceShortcuts.map((shortcut) => (
                      <Link
                        key={shortcut.href}
                        href={shortcut.href}
                        className="flex items-start justify-between gap-3 rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {shortcut.title}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {shortcut.description}
                          </p>
                        </div>
                        <ArrowUpRight className="mt-0.5 h-4 w-4 text-neutral-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={isVendorDashboard ? "Assigned revenue" : "Total Revenue"} value={fmt(stats?.totalRevenue ?? 0)} change={`+${stats?.revenueChange}%`} trend="up" icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" index={0} />
        <MetricCard label={isVendorDashboard ? "Assigned invoices" : "Invoices Sent"} value={String(stats?.invoicesSent ?? 0)} change={`+${stats?.invoicesChange}`} trend="up" icon={FileText} iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" index={1} />
        <MetricCard label={isVendorDashboard ? "Assigned clients" : "Active Clients"} value={String(stats?.activeClients ?? 0)} change={`+${stats?.clientsChange}`} trend="up" icon={Users} iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" index={2} />
        <MetricCard label={isVendorDashboard ? "Assigned overdue" : "Overdue"} value={fmt(stats?.overdueAmount ?? 0)} change={`${stats?.overdueChange}%`} trend="down" icon={TrendingUp} iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" index={3} />
      </div>

      <motion.div variants={item}>
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Intelligence layer
              </p>
              <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
                Forecasted cash and anomaly signals
              </p>
              <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                {isVendorDashboard
                  ? "A scoped read on the assigned portfolio with predictive signals for overdue concentration, follow-through lag, and short-horizon collection risk."
                  : "Short-horizon intelligence for collection pace, overdue concentration, and recovery freshness across the current workspace."}
              </p>
            </div>
            <Link href="/dashboard/reports?range=90d&status=all" className="inline-flex text-sm font-medium text-neutral-900 dark:text-white">
              Open reporting baseline
            </Link>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="grid gap-3 sm:grid-cols-3">
              {intelligenceSnapshot.forecastMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {metric.label}
                    </p>
                    <Badge
                      variant={
                        metric.tone === "danger"
                          ? "danger"
                          : metric.tone === "warning"
                            ? "warning"
                            : metric.tone === "success"
                              ? "success"
                              : "outline"
                      }
                    >
                      {metric.tone}
                    </Badge>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {intelligenceSnapshot.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge
                        variant={
                          alert.tone === "danger"
                            ? "danger"
                            : alert.tone === "warning"
                              ? "warning"
                              : alert.tone === "success"
                                ? "success"
                                : "outline"
                        }
                      >
                        {alert.tone === "success" ? "stable" : "anomaly"}
                      </Badge>
                      <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
                        {alert.title}
                      </p>
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {alert.detail}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 text-neutral-400" />
                  </div>
                  <Link
                    href={alert.href}
                    className="mt-4 inline-flex text-sm font-medium text-neutral-900 dark:text-white"
                  >
                    {alert.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            {isVendorDashboard ? "Assigned exposure" : "Collection pulse"}
          </p>
          <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
            {fmt(queueSummary.totalOutstanding)}
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {queueSummary.needsTouch > 0
              ? `${queueSummary.needsTouch} invoices currently need a collections touchpoint.`
              : isVendorDashboard
                ? "No assigned invoices currently require vendor-side attention."
                : "Receivables are moving cleanly with no urgent collections work right now."}
          </p>
          <Link href={queueClientOpsHref} className="mt-4 inline-flex text-sm font-medium text-neutral-900 dark:text-white">
            {isVendorDashboard ? "Open assigned clients" : "Open client workspace"}
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            {isVendorDashboard ? "Assigned account focus" : "Top billed account"}
          </p>
          <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
            {biggestExposure?.name ?? "No account at risk"}
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {biggestExposure
              ? `${fmt(biggestExposure.total_revenue)} billed across ${biggestExposure.invoice_count} invoices in the current reporting pulse.`
              : isVendorDashboard
                ? "Assigned client highlights will appear once invoices are linked to your seat."
                : "Once invoices are active, the dashboard will highlight the account with the heaviest billed activity."}
          </p>
          <Link href={buildClientOpsViewHref("all-accounts")} className="mt-4 inline-flex text-sm font-medium text-neutral-900 dark:text-white">
            {isVendorDashboard ? "Open assigned client ops" : "Open client ops"}
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Workspace mode</p>
          <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
            {isVendorDashboard
              ? "Assigned vendor scope"
              : permissions.can("invoices:create")
                ? "Operator access"
                : "Read-only reporting"}
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {isVendorDashboard
              ? "Your seat is restricted to assigned clients and invoice context without internal mutation controls."
              : permissions.can("invoices:create")
              ? "You can create invoices, manage workflows, and drill into account activity from the dashboard."
              : "Your current role is optimized for monitoring workspace performance without changing invoice state."}
          </p>
          <Link href={permissions.can("invoices:create") ? "/dashboard/invoices" : "/dashboard/reports"} className="mt-4 inline-flex text-sm font-medium text-neutral-900 dark:text-white">
            {permissions.can("invoices:create") ? "Manage invoices" : "Open reports"}
          </Link>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                Operations board
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Queue-level visibility for what should be worked next across receivables.
              </p>
            </div>
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
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200/70 p-3 dark:border-neutral-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Stale owned work
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                    {accountabilitySummary.staleOwned}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Owned invoices without an operator touch in more than 7 days.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/70 p-3 dark:border-neutral-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Unowned queue
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                    {accountabilitySummary.unowned}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Queue items that do not yet show a workflow owner.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/70 p-3 dark:border-neutral-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Untouched overdue
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                    {accountabilitySummary.untouchedOverdue}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Overdue invoices still waiting on their first reminder touchpoint.
                  </p>
                </div>
              </div>
              {visibleQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  {queuePreset === "unreminded"
                    ? "Every open invoice already has a logged follow-up touchpoint."
                    : "No invoices match this queue preset right now."}
                </div>
              ) : (
                visibleQueue.map((item) => (
                  <div
                    key={item.invoice.id}
                    className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
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
                          {item.clientName} &middot; {formatLatestReminderStatus(item)}
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {accountabilityByInvoiceId.get(item.invoice.id)?.ownerName
                            ? `Owned by ${accountabilityByInvoiceId.get(item.invoice.id)?.ownerName}`
                            : "No workflow owner recorded yet"}
                          {accountabilityByInvoiceId.get(item.invoice.id)?.lastTouchedAt
                            ? ` | Last touch ${timeAgo(accountabilityByInvoiceId.get(item.invoice.id)?.lastTouchedAt ?? "")}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {fmt(item.outstandingAmount)}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {item.daysUntilDue < 0
                            ? `${Math.abs(item.daysUntilDue)}d overdue`
                            : item.daysUntilDue === 0
                              ? "Due today"
                              : `Due in ${item.daysUntilDue}d`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                      <Link
                        href={`/dashboard/invoices/${item.invoice.id}`}
                        className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        Open invoice
                      </Link>
                      {permissions.can("invoices:update") && canRecordReminder(item.invoice) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={reminderInvoiceId === item.invoice.id}
                          leftIcon={<BellRing className="h-4 w-4" />}
                          onClick={() => handleRecordReminder(item.invoice)}
                        >
                          Record reminder
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">
                          {permissions.can("invoices:update")
                            ? "No reminder needed"
                            : "Read-only queue view"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Queue summary
                </p>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Open invoices</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {queueSummary.openInvoices}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Need touch</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {queueSummary.needsTouch}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Overdue</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {queueSummary.overdue}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Without reminder</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {queueSummary.unreminded}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  At-risk accounts
                </p>
                <div className="mt-3 space-y-3">
                  {clientRiskRanking.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Client risk ranking will appear once invoice activity is underway.
                    </p>
                  ) : (
                    clientRiskRanking.map((client) => (
                      <Link
                        key={client.id}
                        href={`/dashboard/clients/${client.id}`}
                        className="flex items-start justify-between gap-3 rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {client.name}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {client.overdueTotal > 0
                              ? `${fmt(client.overdueTotal)} overdue`
                              : `${fmt(client.openExposure)} open exposure`}
                          </p>
                        </div>
                        <Badge variant={client.healthVariant}>
                          {client.healthLabel}
                        </Badge>
                      </Link>
                    ))
                  )}
                </div>
                <Link
                  href={buildClientOpsViewHref("at-risk-accounts")}
                  className="mt-4 inline-flex text-sm font-medium text-neutral-900 dark:text-white"
                >
                  Open at-risk accounts
                </Link>
              </div>
              <div className="rounded-xl border border-neutral-200/70 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                {permissions.can("invoices:update")
                  ? `Managers and above can log reminders directly from the dashboard queue. ${accountabilitySummary.activeRecently} queue item${accountabilitySummary.activeRecently === 1 ? "" : "s"} were touched in the last 3 days.`
                  : "Your role can monitor queue health and ownership posture here, while invoice updates stay with operators."}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-7">
        <motion.div variants={item} className="lg:col-span-4">
          <Card><h2 className="mb-4 text-base font-semibold text-neutral-900 dark:text-white">Revenue overview</h2><RevenueChart data={revenueData} /></Card>
        </motion.div>
        <motion.div variants={item} className="lg:col-span-3">
          <Card><h2 className="mb-4 text-base font-semibold text-neutral-900 dark:text-white">Invoice status</h2>{statusData.length > 0 ? <StatusChart data={statusData} /> : <p className="py-8 text-center text-sm text-neutral-400">No invoices yet</p>}</Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <motion.div variants={item} className="lg:col-span-4">
          <Card padding="none">
            <div className="flex items-center justify-between p-5 pb-0">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Recent invoices</h2>
              <Link href="/dashboard/invoices"><Button variant="ghost" size="sm" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>View all</Button></Link>
            </div>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
              {recent.map(inv => (
                <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <div><p className="text-sm font-medium text-neutral-900 dark:text-white">{inv.invoice_number}</p><p className="text-xs text-neutral-500">{(inv.client as Client | undefined)?.name ?? "Unknown client"} &middot; {fmtDate(inv.issue_date)}</p></div>
                  <div className="flex items-center gap-3"><StatusBadge status={inv.status} /><span className="text-sm font-medium text-neutral-900 dark:text-white">{fmt(Number(inv.total))}</span></div>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} className="lg:col-span-3">
          <Card padding="none">
            <div className="p-5 pb-0"><h2 className="text-base font-semibold text-neutral-900 dark:text-white">Activity</h2></div>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
              {activity.length === 0 ? <p className="px-5 py-8 text-center text-sm text-neutral-400">No activity yet</p> : activity.slice(0, 6).map(e => (
                <div key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={e.profile?.full_name} src={e.profile?.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-700 dark:text-neutral-300"><span className="font-medium">{e.profile?.full_name ?? "System"}</span> <span>{getActivityLabel(e.action).toLowerCase()}</span> <span className="font-medium">{getActivitySubject(e)}</span></p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400"><Clock className="h-3 w-3" />{timeAgo(e.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
