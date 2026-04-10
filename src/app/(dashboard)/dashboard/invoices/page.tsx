"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BellRing, FileText, Plus, Sparkles } from "lucide-react";
import { InvoiceRowActions } from "@/components/dashboard/invoice-row-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  buildCollectionsQueue,
  formatLatestReminderStatus,
  formatQueuePriority,
  type ReminderActivityLike,
} from "@/lib/collections/queue";
import { buildInvoiceBillingReference } from "@/lib/invoices/reference";
import { buildWorkflowAccountabilityMap } from "@/lib/operations/accountability";
import {
  fetchVendorAssignedClientIds,
  isVendorRole,
} from "@/lib/rbac/vendor-access";
import { useInvoiceRealtime } from "@/lib/supabase/realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import type { Client, Invoice, InvoiceStatus } from "@/types/database";

const statuses: { label: string; value: InvoiceStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Viewed", value: "viewed" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
  { label: "Cancelled", value: "cancelled" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function buildInvoiceNumber() {
  const dateChunk = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomChunk = Math.floor(100 + Math.random() * 900);
  return `INV-${dateChunk}-${randomChunk}`;
}

export default function InvoicesPage() {
  const router = useRouter();
  const { currentOrg } = useOrgStore();
  const { user } = useAuth();
  const { can, role } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);
  const collectionsPreset = useUIStore((s) => s.collectionsPreset);
  const setCollectionsPreset = useUIStore((s) => s.setCollectionsPreset);
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftForm, setDraftForm] = useState({
    client_id: "",
    invoice_number: buildInvoiceNumber(),
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      .toISOString()
      .slice(0, 10),
    subtotal: "0",
    tax_rate: "0",
    notes: "",
  });
  const canCreateInvoices = can("invoices:create");

  const fetchInvoices = useCallback(async () => {
    if (!currentOrg) {
      return;
    }

    const sb = getSupabaseBrowserClient();
    const assignedClientIds = isVendorRole(role)
      ? await fetchVendorAssignedClientIds(sb, currentOrg.id, user?.id)
      : [];

    if (isVendorRole(role) && assignedClientIds.length === 0) {
      setInvoices([]);
      setClients([]);
      setReminders([]);
      setWorkflowActivity([]);
      setLoading(false);
      return;
    }

    let query = sb
      .from("invoices")
      .select("*, client:clients(id, name, email, company)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    let clientQuery = sb
      .from("clients")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("is_active", true)
      .order("name");

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.ilike("invoice_number", `%${search}%`);
    }

    if (isVendorRole(role)) {
      query = query.in("client_id", assignedClientIds);
      clientQuery = clientQuery.in("id", assignedClientIds);
    }

    const [invoiceRes, clientRes] = await Promise.all([query, clientQuery]);

    const nextInvoices = (invoiceRes.data ?? []) as Invoice[];
    const nextClients = (clientRes.data ?? []) as Client[];
    const invoiceIds = nextInvoices.map((invoice) => invoice.id);
    const [reminderRes, activityRes] = invoiceIds.length > 0
      ? await Promise.all([
          sb
            .from("activity_log")
            .select("entity_id, created_at, metadata")
            .eq("org_id", currentOrg.id)
            .eq("entity_type", "invoice")
            .eq("action", "invoice.reminder_sent")
            .in("entity_id", invoiceIds)
            .order("created_at", { ascending: false })
            .limit(200),
          sb
            .from("activity_log")
            .select("entity_id, action, created_at, profile:profiles(full_name, avatar_url)")
            .eq("org_id", currentOrg.id)
            .eq("entity_type", "invoice")
            .in("entity_id", invoiceIds)
            .order("created_at", { ascending: false })
            .limit(300),
        ])
      : [{ data: [] as ReminderActivityLike[] }, { data: [] as Array<{ entity_id: string; action: string; created_at: string; profile?: { full_name: string | null; avatar_url: string | null } | null; }> }];

    setInvoices(nextInvoices);
    setClients(nextClients);
    setReminders((reminderRes.data ?? []) as ReminderActivityLike[]);
    setWorkflowActivity(
      (activityRes.data ?? []) as Array<{
        entity_id: string;
        action: string;
        created_at: string;
        profile?: { full_name: string | null; avatar_url: string | null } | null;
      }>
    );
    setDraftForm((current) => ({
      ...current,
      client_id: current.client_id || nextClients[0]?.id || "",
    }));
    setLoading(false);
  }, [currentOrg, role, search, status, user?.id]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useInvoiceRealtime(currentOrg?.id, fetchInvoices);

  useEffect(() => {
    if (!clients.length || typeof window === "undefined" || !canCreateInvoices) {
      if (typeof window === "undefined") {
        return;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    const compose = params.get("compose");
    const queue = params.get("queue");

    if (canCreateInvoices && compose === "1") {
      setComposerOpen(true);
    }

    if (
      queue &&
      ["all", "needs-touch", "overdue", "unreminded"].includes(queue) &&
      queue !== collectionsPreset
    ) {
      setCollectionsPreset(queue as typeof collectionsPreset);
    }

    if (
      canCreateInvoices &&
      clientId &&
      clients.some((client) => client.id === clientId)
    ) {
      setDraftForm((current) => ({
        ...current,
        client_id: clientId,
      }));
    }
  }, [canCreateInvoices, clients, collectionsPreset, setCollectionsPreset]);

  async function createDraftInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentOrg || !user) {
      return;
    }

    const subtotal = Number(draftForm.subtotal);
    const taxRate = Number(draftForm.tax_rate);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    setSaving(true);
    const sb = getSupabaseBrowserClient();
    const { data, error } = await sb
      .from("invoices")
      .insert({
        org_id: currentOrg.id,
        client_id: draftForm.client_id,
        invoice_number: draftForm.invoice_number,
        status: "draft",
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        issue_date: draftForm.issue_date,
        due_date: draftForm.due_date,
        notes: draftForm.notes || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      addToast({
        type: "error",
        title: "Draft creation failed",
        description: error.message,
      });
      setSaving(false);
      return;
    }

    addToast({
      type: "success",
      title: "Draft invoice created",
      description: `${draftForm.invoice_number} is ready for review.`,
    });

    if (data?.id) {
      const selectedClient = clients.find((client) => client.id === draftForm.client_id);
      await recordActivity({
        orgId: currentOrg.id,
        userId: user.id,
        entityType: "invoice",
        entityId: data.id,
        action: "invoice.created",
        metadata: {
          billing_reference: buildInvoiceBillingReference(
            currentOrg.id,
            data.id,
            draftForm.invoice_number
          ),
          invoice_id: data.id,
          invoice_number: draftForm.invoice_number,
          org_id: currentOrg.id,
          client_name: selectedClient?.name ?? null,
          total,
        },
      });
    }

    setSaving(false);
    setComposerOpen(false);
    setDraftForm({
      client_id: clients[0]?.id || "",
      invoice_number: buildInvoiceNumber(),
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        .toISOString()
        .slice(0, 10),
      subtotal: "0",
      tax_rate: "0",
      notes: "",
    });
    await fetchInvoices();

    if (data?.id) {
      router.push(`/dashboard/invoices/${data.id}`);
    }
  }

  const metrics = useMemo(() => {
    const collectionsQueue = buildCollectionsQueue(invoices, reminders);
    return {
      total: invoices.length,
      draft: invoices.filter((invoice) => invoice.status === "draft").length,
      needsTouch: collectionsQueue.filter((item) => item.priority !== "monitor").length,
      remindersLogged: collectionsQueue.filter((item) => item.reminderCount > 0).length,
    };
  }, [invoices, reminders]);

  const collectionsQueue = useMemo(
    () => buildCollectionsQueue(invoices, reminders),
    [invoices, reminders]
  );

  const filteredInvoices = useMemo(() => {
    if (collectionsPreset === "all") {
      return invoices;
    }

    const queueInvoiceIds = new Set(
      collectionsQueue
        .filter((item) => {
          if (collectionsPreset === "needs-touch") {
            return item.priority !== "monitor";
          }
          if (collectionsPreset === "overdue") {
            return item.invoice.status === "overdue";
          }
          if (collectionsPreset === "unreminded") {
            return item.reminderCount === 0;
          }
          return true;
        })
        .map((item) => item.invoice.id)
    );

    return invoices.filter((invoice) => queueInvoiceIds.has(invoice.id));
  }, [collectionsPreset, collectionsQueue, invoices]);

  const queueByInvoiceId = useMemo(
    () => new Map(collectionsQueue.map((item) => [item.invoice.id, item])),
    [collectionsQueue]
  );
  const accountabilityByInvoiceId = useMemo(
    () => buildWorkflowAccountabilityMap(workflowActivity),
    [workflowActivity]
  );

  const columns: Column<Invoice>[] = [
    {
      key: "invoice_number",
      header: "Invoice",
      sortable: true,
      width: "180px",
      render: (row) => (
        <Link
          href={`/dashboard/invoices/${row.id}`}
          className="font-medium text-neutral-900 hover:underline dark:text-white"
        >
          {row.invoice_number}
        </Link>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (row) => (
        <div>
          <p className="text-neutral-900 dark:text-white">
            {(row.client as Client | undefined)?.name ?? "-"}
          </p>
          <p className="text-xs text-neutral-500">
            {accountabilityByInvoiceId.get(row.id)?.ownerName
              ? `Owned by ${accountabilityByInvoiceId.get(row.id)?.ownerName}`
              : queueByInvoiceId.get(row.id)?.latestReminderAt
                ? `${formatLatestReminderStatus(queueByInvoiceId.get(row.id)!)}`
                : (row.client as Client | undefined)?.company ?? ""}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "180px",
      render: (row) => {
        const queueItem = queueByInvoiceId.get(row.id);
        const accountability = accountabilityByInvoiceId.get(row.id);
        return (
          <div className="space-y-1">
            <StatusBadge status={row.status} />
            {accountability?.lastTouchedAt ? (
              <p className="text-xs text-neutral-500">
                {accountability.lastActorName ?? "System"} · {timeAgo(accountability.lastTouchedAt)}
              </p>
            ) : queueItem ? (
              <p className="text-xs text-neutral-500">
                {formatQueuePriority(queueItem.priority)}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "issue_date",
      header: "Date",
      sortable: true,
      width: "130px",
      render: (row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {fmtDate(row.issue_date)}
        </span>
      ),
    },
    {
      key: "due_date",
      header: "Due",
      sortable: true,
      width: "130px",
      render: (row) => {
        const overdue =
          new Date(row.due_date) < new Date() && row.status !== "paid";
        const queueItem = queueByInvoiceId.get(row.id);
        return (
          <div>
            <span
              className={
                overdue
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-neutral-600 dark:text-neutral-400"
              }
            >
              {fmtDate(row.due_date)}
            </span>
            {queueItem && (
              <p className="text-xs text-neutral-400">
                {queueItem.daysUntilDue < 0
                  ? `${Math.abs(queueItem.daysUntilDue)}d overdue`
                  : queueItem.daysUntilDue === 0
                    ? "Due today"
                    : `Due in ${queueItem.daysUntilDue}d`}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "total",
      header: "Amount",
      sortable: true,
      width: "120px",
      render: (row) => (
        <span className="font-medium text-neutral-900 dark:text-white">
          {fmt(Number(row.total))}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (row) => <InvoiceRowActions invoice={row} onUpdated={fetchInvoices} />,
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
            Invoices
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isVendorRole(role)
              ? "Review only the invoice portfolio assigned to your vendor seat."
              : "Create, reconcile, and operationalize your receivables workflow."}
          </p>
        </div>
        {canCreateInvoices && (
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setComposerOpen((current) => !current)}
          >
            {composerOpen ? "Close composer" : "Create draft"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Portfolio
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {metrics.total}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Tracked invoices in the current view.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Draft queue
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {metrics.draft}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Documents still waiting for send-off.
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
            Collection items that should be worked next.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Reminded
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {metrics.remindersLogged}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Open invoices with at least one follow-up logged.
          </p>
        </Card>
      </div>

      {collectionsQueue.length > 0 && (
        <Card>
          <CardTitle>Collections queue</CardTitle>
          <CardDescription>
            Prioritized receivables work based on due dates and reminder history.
          </CardDescription>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {collectionsQueue.slice(0, 3).map((item) => (
              <Link
                key={item.invoice.id}
                href={`/dashboard/invoices/${item.invoice.id}`}
                className="rounded-xl border border-neutral-200/70 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {item.invoice.invoice_number}
                  </p>
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
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {item.clientName}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {accountabilityByInvoiceId.get(item.invoice.id)?.ownerName
                    ? `Owned by ${accountabilityByInvoiceId.get(item.invoice.id)?.ownerName}`
                    : "No workflow owner recorded yet"}
                  {accountabilityByInvoiceId.get(item.invoice.id)?.lastTouchedAt
                    ? ` · Last touch ${timeAgo(accountabilityByInvoiceId.get(item.invoice.id)!.lastTouchedAt!)}`
                    : ""}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Outstanding</span>
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {fmt(item.outstandingAmount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {item.daysUntilDue < 0
                      ? `${Math.abs(item.daysUntilDue)}d overdue`
                      : item.daysUntilDue === 0
                        ? "Due today"
                        : `Due in ${item.daysUntilDue}d`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BellRing className="h-3.5 w-3.5" />
                    {formatLatestReminderStatus(item)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {composerOpen && canCreateInvoices && (
        <Card>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neutral-400" />
            <CardTitle>Draft composer</CardTitle>
          </div>
          <CardDescription>
            Stand up a new invoice quickly, then refine line items from the detail view.
          </CardDescription>
          <form onSubmit={createDraftInvoice} className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Client
                </label>
                <select
                  value={draftForm.client_id}
                  onChange={(event) =>
                    setDraftForm((current) => ({
                      ...current,
                      client_id: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.company ? ` - ${client.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Invoice number"
                value={draftForm.invoice_number}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    invoice_number: event.target.value,
                  }))
                }
                required
              />
              <Input
                label="Subtotal"
                type="number"
                min="0"
                step="0.01"
                value={draftForm.subtotal}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    subtotal: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-4">
              <Input
                label="Issue date"
                type="date"
                value={draftForm.issue_date}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    issue_date: event.target.value,
                  }))
                }
                required
              />
              <Input
                label="Due date"
                type="date"
                value={draftForm.due_date}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    due_date: event.target.value,
                  }))
                }
                required
              />
              <Input
                label="Tax rate"
                type="number"
                min="0"
                step="0.01"
                value={draftForm.tax_rate}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    tax_rate: event.target.value,
                  }))
                }
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Notes
                </label>
                <textarea
                  value={draftForm.notes}
                  onChange={(event) =>
                    setDraftForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  placeholder="Optional client-facing note or internal context."
                />
              </div>
            </div>
            <div className="flex justify-end lg:col-span-2">
              <Button type="submit" isLoading={saving}>
                Save draft invoice
              </Button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        data={filteredInvoices}
        columns={columns}
        searchPlaceholder="Search invoices..."
        searchKey="invoice_number"
        pageSize={10}
        isLoading={loading}
        onSearch={setSearch}
        emptyState={
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description={
              isVendorRole(role)
                ? "An admin needs to assign client visibility before invoices will appear here."
                : "Create your first invoice to start tracking revenue."
            }
            actionLabel={canCreateInvoices ? "Create draft" : undefined}
            onAction={canCreateInvoices ? () => setComposerOpen(true) : undefined}
          />
        }
        toolbar={
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex items-center gap-1">
              {statuses.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => {
                    setStatus(entry.value);
                    setLoading(true);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    status === entry.value
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: "All open", value: "all" as const },
                { label: "Needs touch", value: "needs-touch" as const },
                { label: "Overdue", value: "overdue" as const },
                { label: "Unreminded", value: "unreminded" as const },
              ].map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setCollectionsPreset(entry.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    collectionsPreset === entry.value
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        }
      />
    </motion.div>
  );
}
