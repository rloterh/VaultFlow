"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Send,
  XCircle,
} from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getActivityLabel,
  getActivitySubject,
} from "@/lib/activity/presentation";
import {
  getInvoiceCollectionsMessage,
  getInvoiceTransitions,
  transitionInvoiceStatus,
} from "@/lib/invoices/lifecycle";
import { useUIStore } from "@/stores/ui-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Client, Invoice, InvoiceItem } from "@/types/database";

interface InvoiceActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

type InvoiceDetailRecord = Omit<Invoice, "client"> & {
  client?: Client | null;
  items?: InvoiceItem[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
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

const transitionIconMap = {
  draft: FileText,
  sent: Send,
  viewed: Eye,
  paid: CheckCircle2,
  overdue: AlertTriangle,
  cancelled: XCircle,
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { can } = usePermissions();
  const addToast = useUIStore((s) => s.addToast);
  const [invoice, setInvoice] = useState<InvoiceDetailRecord | null>(null);
  const [activity, setActivity] = useState<InvoiceActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      const sb = getSupabaseBrowserClient();
      const [invoiceRes, activityRes] = await Promise.all([
        sb
          .from("invoices")
          .select("*, client:clients(*), items:invoice_items(*)")
          .eq("id", id)
          .single(),
        sb
          .from("activity_log")
          .select("*, profile:profiles(full_name, avatar_url)")
          .eq("entity_type", "invoice")
          .eq("entity_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      setInvoice((invoiceRes.data as InvoiceDetailRecord | null) ?? null);
      setActivity((activityRes.data ?? []) as InvoiceActivityEntry[]);
      setLoading(false);
    }

    if (id) {
      void fetchInvoice();
    }
  }, [id]);

  async function handleStatusTransition(nextStatus: Invoice["status"]) {
    if (!invoice) {
      return;
    }

    setUpdatingStatus(nextStatus);
    try {
      const updated = await transitionInvoiceStatus(invoice, nextStatus, user?.id);
      setInvoice(updated);
      const sb = getSupabaseBrowserClient();
      const { data } = await sb
        .from("activity_log")
        .select("*, profile:profiles(full_name, avatar_url)")
        .eq("entity_type", "invoice")
        .eq("entity_id", invoice.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setActivity((data ?? []) as InvoiceActivityEntry[]);
      addToast({
        type: "success",
        title: `Invoice ${nextStatus}`,
        description: `${invoice.invoice_number} was updated successfully.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "The invoice could not be updated.",
      });
    } finally {
      setUpdatingStatus(null);
    }
  }

  const canUpdateInvoices = can("invoices:update");
  const transitions = invoice ? getInvoiceTransitions(invoice.status) : [];
  const client = invoice?.client ?? null;
  const items = useMemo(
    () => [...(invoice?.items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [invoice?.items]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-lg font-medium text-neutral-900 dark:text-white">
          Invoice not found
        </h2>
        <Link href="/dashboard/invoices">
          <Button variant="ghost" className="mt-4">
            Back to invoices
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
          <Link href="/dashboard/invoices">
            <button className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
              {invoice.status === "overdue" && (
                <Badge variant="warning">Collections attention</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Issued {fmtDate(invoice.issue_date)} and due {fmtDate(invoice.due_date)}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUpdateInvoices &&
            transitions.map((transition, index) => {
              const Icon = transitionIconMap[transition.status];
              return (
                <Button
                  key={transition.status}
                  variant={index === 0 && transition.tone !== "danger" ? "primary" : transition.tone === "danger" ? "danger" : "outline"}
                  isLoading={updatingStatus === transition.status}
                  leftIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                  onClick={() => handleStatusTransition(transition.status)}
                >
                  {transition.label}
                </Button>
              );
            })}
          <Button
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => {
              const link = document.createElement("a");
              link.href = `/api/invoices/${id}/pdf`;
              link.download = `${invoice.invoice_number}.pdf`;
              link.click();
            }}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-6 border-b border-neutral-100 pb-6 dark:border-neutral-800 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Bill to
              </p>
              <p className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">
                {client?.name ?? "Unknown"}
              </p>
              {client?.company && (
                <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                  <Building2 className="h-3.5 w-3.5" />
                  {client.company}
                </p>
              )}
              <p className="mt-1 text-sm text-neutral-500">{client?.email}</p>
              {client?.city && (
                <p className="text-sm text-neutral-500">
                  {[client.address_line1, client.city, client.state, client.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Amount due
              </p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-white">
                {fmt(Number(invoice.total))}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500 md:justify-end">
                <Clock className="h-3.5 w-3.5" />
                {getInvoiceCollectionsMessage(invoice)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Description
                  </th>
                  <th className="w-24 pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Qty
                  </th>
                  <th className="w-32 pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Unit price
                  </th>
                  <th className="w-32 pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-neutral-50 dark:border-neutral-800/50"
                    >
                      <td className="py-3.5 text-sm text-neutral-900 dark:text-white">
                        {item.description}
                      </td>
                      <td className="py-3.5 text-right text-sm text-neutral-600 dark:text-neutral-400">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 text-right text-sm text-neutral-600 dark:text-neutral-400">
                        {fmt(Number(item.unit_price))}
                      </td>
                      <td className="py-3.5 text-right text-sm font-medium text-neutral-900 dark:text-white">
                        {fmt(Number(item.amount))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-neutral-400">
                      No line items added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="text-neutral-900 dark:text-white">
                  {fmt(Number(invoice.subtotal))}
                </span>
              </div>
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Tax ({invoice.tax_rate}%)</span>
                  <span className="text-neutral-900 dark:text-white">
                    {fmt(Number(invoice.tax_amount))}
                  </span>
                </div>
              )}
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Discount</span>
                  <span className="text-emerald-600">
                    -{fmt(Number(invoice.discount_amount))}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Total
                </span>
                <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {fmt(Number(invoice.total))}
                </span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/30">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Notes
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {invoice.notes}
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Lifecycle controls</CardTitle>
            <CardDescription>
              Advance the invoice through collections and client follow-up.
            </CardDescription>
            <div className="mt-4 space-y-3">
              {transitions.length > 0 ? (
                transitions.map((transition) => (
                  <div
                    key={transition.status}
                    className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {transition.label}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {transition.description}
                        </p>
                      </div>
                      <Badge variant={transition.tone === "danger" ? "danger" : "outline"}>
                        {transition.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No further lifecycle actions are available for this invoice.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Collections context</CardTitle>
            <CardDescription>
              Operating guidance for the current billing posture.
            </CardDescription>
            <div className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/40">
                {getInvoiceCollectionsMessage(invoice)}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Outstanding balance</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {fmt(Number(invoice.total) - Number(invoice.amount_paid ?? 0))}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Sent at</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {invoice.sent_at ? fmtDate(invoice.sent_at) : "Not sent"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Paid at</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {invoice.paid_at ? fmtDate(invoice.paid_at) : "Not paid"}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Invoice audit trail</CardTitle>
            <CardDescription>
              Track changes and recipient lifecycle events tied to this invoice.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {activity.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No operational events are recorded for this invoice yet.
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
