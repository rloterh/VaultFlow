"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Building2,
  Calendar,
  DollarSign,
  FilePlus2,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge, Avatar, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  buildCollectionsQueue,
  formatLatestReminderStatus,
  formatQueuePriority,
  type ReminderActivityLike,
} from "@/lib/collections/queue";
import {
  canRecordReminder,
  recordInvoiceReminder,
} from "@/lib/invoices/follow-up";
import {
  getActivityLabel,
  getActivitySubject,
} from "@/lib/activity/presentation";
import { buildClientFinancialSnapshot } from "@/lib/clients/insights";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import type { Client, Invoice } from "@/types/database";

interface ClientActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(value: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { can } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activity, setActivity] = useState<ClientActivityEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderActivityLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [recordingReminderId, setRecordingReminderId] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    const [clientRes, invoiceRes] = await Promise.all([
      sb.from("clients").select("*").eq("id", id).single(),
      sb
        .from("invoices")
        .select("*")
        .eq("client_id", id)
        .order("issue_date", { ascending: false }),
    ]);

    const nextClient = (clientRes.data as Client | null) ?? null;
    const nextInvoices = (invoiceRes.data ?? []) as Invoice[];
    const invoiceIds = nextInvoices.map((invoice) => invoice.id);

    const activityRequests = [
      sb
        .from("activity_log")
        .select("*, profile:profiles(full_name, avatar_url)")
        .eq("entity_type", "client")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(6),
    ];
    const reminderRequest =
      invoiceIds.length > 0
        ? sb
            .from("activity_log")
            .select("entity_id, created_at, metadata")
            .eq("entity_type", "invoice")
            .eq("action", "invoice.reminder_sent")
            .in("entity_id", invoiceIds)
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as ReminderActivityLike[] });

    if (invoiceIds.length > 0) {
      activityRequests.push(
        sb
          .from("activity_log")
          .select("*, profile:profiles(full_name, avatar_url)")
          .eq("entity_type", "invoice")
          .in("entity_id", invoiceIds)
          .order("created_at", { ascending: false })
          .limit(10)
      );
    }

    const [activityResponses, reminderResponse] = await Promise.all([
      Promise.all(activityRequests),
      reminderRequest,
    ]);
    const mergedActivity = activityResponses
      .flatMap((response) => response.data ?? [])
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      )
      .slice(0, 8) as ClientActivityEntry[];

    setClient(nextClient);
    setInvoices(nextInvoices);
    setActivity(mergedActivity);
    setReminders((reminderResponse.data ?? []) as ReminderActivityLike[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchClient();
    }
  }, [fetchClient, id]);

  async function archiveClient() {
    if (!client || !can("clients:delete")) {
      return;
    }

    setArchiving(true);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb
      .from("clients")
      .update({ is_active: false })
      .eq("id", client.id);

    if (error) {
      addToast({
        type: "error",
        title: "Unable to archive client",
        description: error.message,
      });
      setArchiving(false);
      return;
    }

    await recordActivity({
      orgId: client.org_id,
      userId: user?.id,
      entityType: "client",
      entityId: client.id,
      action: "client.archived",
      metadata: {
        client_name: client.name,
        email: client.email,
      },
    });

    addToast({
      type: "success",
      title: "Client archived",
      description: `${client.name} was moved out of active client workflow.`,
    });
    window.location.href = "/dashboard/clients";
  }

  async function handleRecordReminder(invoice: Invoice) {
    setRecordingReminderId(invoice.id);
    const success = await recordInvoiceReminder(invoice, user?.id);

    if (!success) {
      addToast({
        type: "error",
        title: "Reminder could not be recorded",
        description: "Try again after the activity log reconnects.",
      });
      setRecordingReminderId(null);
      return;
    }

    await fetchClient();
    addToast({
      type: "success",
      title: "Reminder recorded",
      description: `A follow-up touchpoint was logged for ${invoice.invoice_number}.`,
    });
    setRecordingReminderId(null);
  }

  const summary = useMemo(() => buildClientFinancialSnapshot(invoices), [invoices]);
  const collectionsQueue = useMemo(
    () => buildCollectionsQueue(invoices, reminders),
    [invoices, reminders]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-white">
          Client not found
        </h2>
        <Link href="/dashboard/clients">
          <Button variant="ghost" className="mt-4">
            Back to clients
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/clients">
            <button className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <Avatar name={client.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {client.name}
              </h1>
              <Badge variant={summary.healthVariant}>{summary.healthLabel}</Badge>
              {summary.overdueTotal > 0 && (
                <Badge variant="danger">Overdue balance</Badge>
              )}
            </div>
            {client.company && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                <Building2 className="h-3.5 w-3.5" />
                {client.company}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            leftIcon={<Mail className="h-4 w-4" />}
            onClick={() => window.open(`mailto:${client.email}`, "_self")}
          >
            Email client
          </Button>
          {can("invoices:create") && (
            <Link href={`/dashboard/invoices?compose=1&clientId=${client.id}`}>
              <Button leftIcon={<FilePlus2 className="h-4 w-4" />}>
                Create invoice
              </Button>
            </Link>
          )}
          {can("clients:delete") && (
            <Button
              variant="danger"
              isLoading={archiving}
              leftIcon={<AlertTriangle className="h-4 w-4" />}
              onClick={archiveClient}
            >
              Archive client
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Collected revenue"
          value={fmt(summary.paidTotal)}
          icon={DollarSign}
          iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          index={0}
        />
        <MetricCard
          label="Open exposure"
          value={fmt(summary.pendingTotal + summary.overdueTotal)}
          icon={FileText}
          iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          index={1}
        />
        <MetricCard
          label="Paid rate"
          value={`${summary.paidRate}%`}
          icon={Calendar}
          iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          index={2}
        />
        <MetricCard
          label="Invoices"
          value={String(summary.totalInvoices)}
          icon={Building2}
          iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
          index={3}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Contact information</CardTitle>
            <CardDescription>
              Primary billing profile and account relationship details.
            </CardDescription>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-700 dark:text-neutral-300">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-neutral-400" />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {client.phone}
                  </span>
                </div>
              )}
              {(client.city || client.address_line1) && (
                <div className="flex items-center gap-3 text-sm sm:col-span-2">
                  <MapPin className="h-4 w-4 text-neutral-400" />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {[client.address_line1, client.city, client.state, client.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card padding="none">
            <div className="p-5 pb-0">
              <CardTitle>Invoice history</CardTitle>
              <CardDescription>
                Receivables movement and billing history for this account.
              </CardDescription>
            </div>
            <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
              {invoices.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">
                  No invoices for this client yet.
                </p>
              ) : (
                invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Issued {fmtDate(invoice.issue_date)} - Due {fmtDate(invoice.due_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={invoice.status} />
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {fmt(Number(invoice.total))}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Collections posture</CardTitle>
            <CardDescription>
              Operator view of what this account needs next.
            </CardDescription>
            <div className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/40">
                {summary.collectionSummary}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Next due date</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {fmtDate(summary.nextDueDate)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Overdue balance</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {fmt(summary.overdueTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Latest invoice</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {fmtDate(summary.lastInvoiceDate)}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Collections queue</CardTitle>
            <CardDescription>
              Invoice follow-up history and the next actions for this account.
            </CardDescription>
            <div className="mt-4 space-y-3">
              {collectionsQueue.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No open collections work is active for this client.
                </p>
              ) : (
                collectionsQueue.map((item) => (
                  <div
                    key={item.invoice.id}
                    className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {item.invoice.invoice_number}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {formatLatestReminderStatus(item)}
                          {item.latestReminderAt ? ` · ${timeAgo(item.latestReminderAt)}` : ""}
                        </p>
                      </div>
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
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-neutral-500">
                        {item.daysUntilDue < 0
                          ? `${Math.abs(item.daysUntilDue)}d overdue`
                          : item.daysUntilDue === 0
                            ? "Due today"
                            : `Due in ${item.daysUntilDue}d`}
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-white">
                        {fmt(item.outstandingAmount)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/invoices/${item.invoice.id}`}
                        className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        Open invoice
                      </Link>
                      {can("invoices:update") && canRecordReminder(item.invoice) && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={recordingReminderId === item.invoice.id}
                          leftIcon={<BellRing className="h-4 w-4" />}
                          onClick={() => handleRecordReminder(item.invoice)}
                        >
                          Record reminder
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Account events across client profile changes and invoice operations.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {activity.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No activity is recorded for this client yet.
                </p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-900 dark:text-white">
                        {getActivityLabel(entry.action)}{" "}
                        <span className="font-medium">{getActivitySubject(entry)}</span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {entry.profile?.full_name ?? "System"} - {timeAgo(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
