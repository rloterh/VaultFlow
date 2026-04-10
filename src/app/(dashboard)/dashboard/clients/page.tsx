"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Clock3,
  Mail,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { ClientRowActions } from "@/components/dashboard/client-row-actions";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  buildClientFinancialSnapshot,
  buildClientCollectionsSummaryMap,
  buildClientInsightMap,
  matchesClientQueuePreset,
  type ClientFinancialSnapshot,
  type ClientCollectionsSummary,
} from "@/lib/clients/insights";
import { type CollectionsQueuePreset, type ReminderActivityLike } from "@/lib/collections/queue";
import {
  buildClientOpsViewHref,
  CLIENT_OPS_VIEWS,
  findMatchingClientOpsView,
  getClientOpsView,
  isClientHealthFilter,
  isClientOpsViewId,
  isClientTouchFilter,
  isCollectionsQueuePreset,
  matchesClientTouchFilter,
  type ClientHealthFilter,
  type ClientOpsViewId,
  type ClientTouchFilter,
} from "@/lib/operations/client-views";
import {
  fetchVendorAssignedClientIds,
  isVendorRole,
} from "@/lib/rbac/vendor-access";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import type { Client, Invoice } from "@/types/database";

type ClientOperationalRow = Client & {
  snapshot: ClientFinancialSnapshot;
  collections: ClientCollectionsSummary;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtDate(value: string | null) {
  if (!value) return "No invoice history";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ClientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrg } = useOrgStore();
  const { user } = useAuth();
  const { can, role } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);
  const storedClientOpsView = useUIStore((s) => s.clientOpsView);
  const [clients, setClients] = useState<ClientOperationalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    company: "",
    city: "",
    country: "US",
  });

  const canCreateClients = can("clients:create");
  const globalQueuePreset = useUIStore((s) => s.collectionsPreset);
  const setQueuePreset = useUIStore((s) => s.setCollectionsPreset);
  const setClientOpsView = useUIStore((s) => s.setClientOpsView);

  const routeViewParam = searchParams.get("view");
  const routeHealthParam = searchParams.get("health");
  const routeQueueParam = searchParams.get("queue");
  const routeTouchParam = searchParams.get("touch");
  const routeView = isClientOpsViewId(routeViewParam) ? routeViewParam : null;
  const activeView = getClientOpsView(routeView ?? storedClientOpsView);
  const healthFilter = isClientHealthFilter(routeHealthParam)
    ? routeHealthParam
    : activeView.health;
  const queuePreset = isCollectionsQueuePreset(routeQueueParam)
    ? routeQueueParam
    : activeView.queuePreset;
  const touchFilter = isClientTouchFilter(routeTouchParam)
    ? routeTouchParam
    : "all";

  const fetchClients = useCallback(async () => {
    if (!currentOrg) {
      return;
    }

    const sb = getSupabaseBrowserClient();
    const assignedClientIds = isVendorRole(role)
      ? await fetchVendorAssignedClientIds(sb, currentOrg.id, user?.id)
      : [];

    if (isVendorRole(role) && assignedClientIds.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    let clientQuery = sb
      .from("clients")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("is_active", true)
      .order("total_revenue", { ascending: false });
    let invoiceQuery = sb
      .from("invoices")
      .select("id, client_id, status, total, issue_date, due_date")
      .eq("org_id", currentOrg.id);

    if (isVendorRole(role)) {
      clientQuery = clientQuery.in("id", assignedClientIds);
      invoiceQuery = invoiceQuery.in("client_id", assignedClientIds);
    }

    const [clientRes, invoiceRes] = await Promise.all([clientQuery, invoiceQuery]);

    const invoiceData = (invoiceRes.data ?? []) as Invoice[];
    const invoiceIds = invoiceData.map((invoice) => invoice.id);
    const reminderResponse =
      invoiceIds.length > 0
        ? await sb
            .from("activity_log")
            .select("entity_id, created_at, metadata")
            .eq("org_id", currentOrg.id)
            .eq("entity_type", "invoice")
            .eq("action", "invoice.reminder_sent")
            .in("entity_id", invoiceIds)
            .order("created_at", { ascending: false })
            .limit(200)
        : { data: [] as ReminderActivityLike[] };
    const reminderData = (reminderResponse.data ?? []) as ReminderActivityLike[];
    const insightMap = buildClientInsightMap(invoiceData);
    const collectionsMap = buildClientCollectionsSummaryMap(invoiceData, reminderData);
    const nextClients = ((clientRes.data ?? []) as Client[]).map((client) => ({
      ...client,
      snapshot:
        insightMap.get(client.id) ??
        buildClientFinancialSnapshot([]),
      collections:
        collectionsMap.get(client.id) ?? {
          openInvoices: 0,
          needsTouch: 0,
          overdue: 0,
          unreminded: 0,
          latestReminderAt: null,
          totalOutstanding: 0,
        },
    }));

    setClients(nextClients);
    setLoading(false);
  }, [currentOrg, role, user?.id]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (queuePreset !== globalQueuePreset) {
      setQueuePreset(queuePreset);
    }
  }, [globalQueuePreset, queuePreset, setQueuePreset]);

  useEffect(() => {
    if (activeView.id !== storedClientOpsView) {
      setClientOpsView(activeView.id);
    }
  }, [activeView.id, setClientOpsView, storedClientOpsView]);

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentOrg || !user) {
      return;
    }

    setSaving(true);
    const sb = getSupabaseBrowserClient();
    const { data, error } = await sb
      .from("clients")
      .insert({
        org_id: currentOrg.id,
        name: clientForm.name,
        email: clientForm.email,
        company: clientForm.company || null,
        city: clientForm.city || null,
        country: clientForm.country,
      })
      .select("id")
      .single();

    if (error) {
      addToast({
        type: "error",
        title: "Client creation failed",
        description: error.message,
      });
      setSaving(false);
      return;
    }

    addToast({
      type: "success",
      title: "Client added",
      description: `${clientForm.name} is now available for invoicing.`,
    });
    await recordActivity({
      orgId: currentOrg.id,
      userId: user.id,
      entityType: "client",
      entityId: data.id,
      action: "client.created",
      metadata: {
        client_name: clientForm.name,
        email: clientForm.email,
      },
    });
    setSaving(false);
    setComposerOpen(false);
    setClientForm({
      name: "",
      email: "",
      company: "",
      city: "",
      country: "US",
    });
    await fetchClients();
  }

  const metrics = useMemo(() => {
    const totalRevenue = clients.reduce(
      (sum, client) => sum + Number(client.total_revenue),
      0
    );
    const openExposure = clients.reduce(
      (sum, client) => sum + client.snapshot.pendingTotal + client.snapshot.overdueTotal,
      0
    );
    const atRisk = clients.filter((client) => client.snapshot.health === "at-risk").length;
    const needsTouch = clients.filter((client) => client.collections.needsTouch > 0).length;
    return {
      total: clients.length,
      revenue: totalRevenue,
      openExposure,
      atRisk,
      needsTouch,
    };
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesHealth =
        healthFilter === "all" ? true : client.snapshot.health === healthFilter;
      const matchesQueue = matchesClientQueuePreset(client.collections, queuePreset);
      const matchesTouch = matchesClientTouchFilter(
        client.collections.latestReminderAt,
        client.collections.openInvoices > 0,
        touchFilter
      );
      return matchesHealth && matchesQueue && matchesTouch;
    });
  }, [clients, healthFilter, queuePreset, touchFilter]);

  const prioritizedClients = useMemo(() => {
    return [...filteredClients]
      .sort((left, right) => {
        const weight = {
          "at-risk": 0,
          attention: 1,
          healthy: 2,
          new: 3,
        } as const;

        return (
          weight[left.snapshot.health] - weight[right.snapshot.health] ||
          right.collections.needsTouch - left.collections.needsTouch ||
          right.collections.totalOutstanding - left.collections.totalOutstanding
        );
      })
      .slice(0, 3);
  }, [filteredClients]);

  function replaceClientView(
    nextHealth: ClientHealthFilter,
    nextQueuePreset: CollectionsQueuePreset,
    nextTouchFilter: ClientTouchFilter = touchFilter
  ) {
    const params = new URLSearchParams(searchParams.toString());
    const matchedView = findMatchingClientOpsView(nextHealth, nextQueuePreset);

    params.set("health", nextHealth);
    params.set("queue", nextQueuePreset);
    if (nextTouchFilter === "all") {
      params.delete("touch");
    } else {
      params.set("touch", nextTouchFilter);
    }
    if (matchedView) {
      params.set("view", matchedView.id);
      setClientOpsView(matchedView.id);
    } else {
      params.delete("view");
    }

    router.replace(params.size ? `/dashboard/clients?${params.toString()}` : "/dashboard/clients");
  }

  function setHealthFilter(nextFilter: ClientHealthFilter) {
    replaceClientView(nextFilter, queuePreset);
  }

  function setQueueFilter(nextPreset: CollectionsQueuePreset) {
    setQueuePreset(nextPreset);
    replaceClientView(healthFilter, nextPreset);
  }

  function setTouchFilter(nextFilter: ClientTouchFilter) {
    replaceClientView(healthFilter, queuePreset, nextFilter);
  }

  function applySavedView(viewId: ClientOpsViewId) {
    const view = getClientOpsView(viewId);
    setQueuePreset(view.queuePreset);
    setClientOpsView(view.id);
    const href = new URL(buildClientOpsViewHref(view.id), "http://localhost");
    if (touchFilter !== "all") {
      href.searchParams.set("touch", touchFilter);
    }
    router.replace(`${href.pathname}?${href.searchParams.toString()}`);
  }

  const activeSavedView = findMatchingClientOpsView(healthFilter, queuePreset);
  const savedViewCounts: Record<string, number> = {
    "collections-focus": metrics.needsTouch,
    "at-risk-accounts": metrics.atRisk,
    "unreminded-open": clients.filter((client) => client.collections.unreminded > 0).length,
    "all-accounts": metrics.total,
  };
  const touchFilterCounts: Record<ClientTouchFilter, number> = {
    all: clients.filter((client) => client.collections.openInvoices > 0).length,
    untouched: clients.filter(
      (client) =>
        client.collections.openInvoices > 0 &&
        client.collections.latestReminderAt === null
    ).length,
    recent: clients.filter((client) =>
      matchesClientTouchFilter(
        client.collections.latestReminderAt,
        client.collections.openInvoices > 0,
        "recent"
      )
    ).length,
    stale: clients.filter((client) =>
      matchesClientTouchFilter(
        client.collections.latestReminderAt,
        client.collections.openInvoices > 0,
        "stale"
      )
    ).length,
  };
  const matchingInvoicesHref = `/dashboard/invoices?queue=${queuePreset}`;
  const matchingReportsHref = `/dashboard/reports?queue=${queuePreset}`;

  const columns: Column<ClientOperationalRow>[] = [
    {
      key: "name",
      header: "Client",
      sortable: true,
      render: (row) => (
        <Link href={`/dashboard/clients/${row.id}`} className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900 hover:underline dark:text-white">
              {row.name}
            </p>
            {row.company && (
              <p className="flex items-center gap-1 text-xs text-neutral-500">
                <Building2 className="h-3 w-3" />
                {row.company}
              </p>
            )}
          </div>
        </Link>
      ),
    },
    {
      key: "health",
      header: "Health",
      sortable: true,
      width: "140px",
      render: (row) => (
        <div className="space-y-1">
          <Badge variant={row.snapshot.healthVariant}>{row.snapshot.healthLabel}</Badge>
          <p className="text-xs text-neutral-500">
            {row.collections.needsTouch > 0
              ? `${row.collections.needsTouch} need touch`
              : `${row.snapshot.openInvoices} open`}
          </p>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
          <Mail className="h-3.5 w-3.5 text-neutral-400" />
          {row.email}
        </span>
      ),
    },
    {
      key: "city",
      header: "Location",
      sortable: true,
      width: "150px",
      render: (row) => (
        <span className="flex items-center gap-1.5 text-neutral-500">
          {row.city ? (
            <>
              <MapPin className="h-3.5 w-3.5" />
              {row.city}, {row.country}
            </>
          ) : (
            "-"
          )}
        </span>
      ),
    },
    {
      key: "open_balance",
      header: "Open balance",
      sortable: true,
      width: "140px",
      render: (row) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-white">
            {fmt(row.snapshot.pendingTotal + row.snapshot.overdueTotal)}
          </p>
          <p className="text-xs text-neutral-500">
            {row.collections.latestReminderAt
              ? `Reminder ${fmtDate(row.collections.latestReminderAt)}`
              : `Next due ${fmtDate(row.snapshot.nextDueDate)}`}
          </p>
        </div>
      ),
    },
    {
      key: "total_revenue",
      header: "Revenue",
      sortable: true,
      width: "130px",
      render: (row) => (
        <span className="font-medium text-neutral-900 dark:text-white">
          {fmt(Number(row.total_revenue))}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (row) => <ClientRowActions client={row} onUpdated={fetchClients} />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Clients
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isVendorRole(role)
              ? "Review only the accounts assigned to your vendor seat."
              : "Manage account relationships, revenue concentration, and collections posture."}
          </p>
        </div>
        {canCreateClients && (
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setComposerOpen((current) => !current)}
          >
            {composerOpen ? "Close form" : "Add client"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Active accounts
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {metrics.total}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Clients currently in the operating roster.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Lifetime revenue
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {fmt(metrics.revenue)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Total revenue concentration across this workspace.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Open exposure
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {fmt(metrics.openExposure)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Receivables still moving through collections.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Needs touch
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {metrics.needsTouch}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Accounts currently carrying collections work.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Client workspace views</CardTitle>
            <CardDescription>
              Saved views travel cleanly from the dashboard into client operations.
            </CardDescription>
          </div>
          <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Current focus:{" "}
            <span className="font-medium text-neutral-900 dark:text-white">
              {activeSavedView?.label ?? "Custom workspace view"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-4">
          {CLIENT_OPS_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => applySavedView(view.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                activeSavedView?.id === view.id
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-200/70 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{view.label}</p>
                  <p
                    className={`mt-2 text-sm ${
                      activeSavedView?.id === view.id
                        ? "text-neutral-200 dark:text-neutral-600"
                        : "text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    {view.description}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    activeSavedView?.id === view.id
                      ? "bg-white/15 text-white dark:bg-neutral-900/10 dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {savedViewCounts[view.id] ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              Fine-tune the current saved view
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Use filters when you need a temporary custom slice without leaving the saved workspace pattern.
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              {can("invoices:update")
                ? "Operators can jump from this account view into queue-matched invoices and record reminder work there."
                : "Your role is optimized for monitoring account health while invoice workflow updates stay with operators."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={matchingInvoicesHref}>
                <Button size="sm" variant="outline">
                  Open matching invoices
                </Button>
              </Link>
              <Link href={matchingReportsHref}>
                <Button size="sm" variant="ghost">
                  Open matching reports
                </Button>
              </Link>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All health", value: "all" as const },
                { label: "At Risk", value: "at-risk" as const },
                { label: "Attention", value: "attention" as const },
                { label: "Healthy", value: "healthy" as const },
                { label: "New", value: "new" as const },
              ].map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setHealthFilter(entry.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    healthFilter === entry.value
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All open", value: "all" as const },
                { label: "Needs touch", value: "needs-touch" as const },
                { label: "Overdue", value: "overdue" as const },
                { label: "Unreminded", value: "unreminded" as const },
              ].map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setQueueFilter(entry.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    queuePreset === entry.value
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All touchpoints", value: "all" as const },
                { label: "Untouched", value: "untouched" as const },
                { label: "Recent", value: "recent" as const },
                { label: "Stale", value: "stale" as const },
              ].map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setTouchFilter(entry.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    touchFilter === entry.value
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {entry.label} ({touchFilterCounts[entry.value]})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {prioritizedClients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400 lg:col-span-3">
              No accounts match this client workspace view yet.
            </div>
          ) : (
            prioritizedClients.map((client) => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                className="rounded-xl border border-neutral-200/70 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {client.name}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {client.company ?? client.email}
                    </p>
                  </div>
                  <Badge variant={client.snapshot.healthVariant}>
                    {client.snapshot.healthLabel}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Open exposure</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {fmt(client.collections.totalOutstanding)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Needs touch</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {client.collections.needsTouch}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    {client.collections.latestReminderAt
                      ? `Reminder ${fmtDate(client.collections.latestReminderAt)}`
                      : "No reminder logged yet"}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>

      {composerOpen && canCreateClients && (
        <Card>
          <CardTitle>New client record</CardTitle>
          <CardDescription>
            Capture the minimum billing profile now, then expand the relationship over time.
          </CardDescription>
          <form onSubmit={createClient} className="mt-6 grid gap-4 lg:grid-cols-2">
            <Input
              label="Client name"
              value={clientForm.name}
              onChange={(event) =>
                setClientForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
            <Input
              type="email"
              label="Billing email"
              value={clientForm.email}
              onChange={(event) =>
                setClientForm((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
            <Input
              label="Company"
              value={clientForm.company}
              onChange={(event) =>
                setClientForm((current) => ({ ...current, company: event.target.value }))
              }
            />
            <Input
              label="City"
              value={clientForm.city}
              onChange={(event) =>
                setClientForm((current) => ({ ...current, city: event.target.value }))
              }
            />
            <Input
              label="Country"
              value={clientForm.country}
              onChange={(event) =>
                setClientForm((current) => ({
                  ...current,
                  country: event.target.value.toUpperCase(),
                }))
              }
              hint="Use ISO country codes where possible, for example US, GB, or AE."
            />
            <div className="flex items-end justify-end lg:col-span-2">
              <Button type="submit" isLoading={saving}>
                Save client
              </Button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        data={filteredClients}
        columns={columns}
        searchPlaceholder="Search clients..."
        searchKey="name"
        pageSize={10}
        isLoading={loading}
        emptyState={
          <EmptyState
            icon={Users}
            title={clients.length === 0 ? "No clients yet" : "No clients match this view"}
            description={
              clients.length === 0
                ? canCreateClients
                  ? "Add your first client to start sending invoices."
                  : isVendorRole(role)
                    ? "An admin needs to assign client visibility before vendor accounts appear here."
                    : "Client accounts will appear here as your team adds them."
                : touchFilter === "all"
                  ? "Adjust the saved view or filters to widen the account roster."
                  : "This reminder cadence filter is narrower than the current account workload."
            }
            actionLabel={
              clients.length === 0 ? (canCreateClients ? "Add client" : undefined) : "Show all accounts"
            }
            onAction={
              clients.length === 0
                ? canCreateClients
                  ? () => setComposerOpen(true)
                  : undefined
                : () => applySavedView("all-accounts")
            }
          />
        }
      />
    </motion.div>
  );
}

function ClientsPageFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="h-32 animate-pulse bg-neutral-50 dark:bg-neutral-900/60" />
        ))}
      </div>
      <Card className="h-64 animate-pulse bg-neutral-50 dark:bg-neutral-900/60" />
      <Card className="h-[420px] animate-pulse bg-neutral-50 dark:bg-neutral-900/60" />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<ClientsPageFallback />}>
      <ClientsPageContent />
    </Suspense>
  );
}
