"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Send, CheckCircle2, Printer,
  FileText, Clock, Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/badge";
import { useUIStore } from "@/stores/ui-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Invoice, InvoiceItem } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const sb = getSupabaseBrowserClient();
      const { data } = await sb
        .from("invoices")
        .select("*, client:clients(*), items:invoice_items(*)")
        .eq("id", id)
        .single();
      setInvoice(data as Invoice | null);
      setLoading(false);
    }
    if (id) fetch();
  }, [id]);

  async function updateStatus(status: string) {
    const sb = getSupabaseBrowserClient();
    const updates: Record<string, unknown> = { status };
    if (status === "sent") updates.sent_at = new Date().toISOString();
    if (status === "paid") updates.paid_at = new Date().toISOString();

    const { error } = await sb
      .from("invoices")
      .update(updates)
      .eq("id", id);

    if (error) {
      addToast({ type: "error", title: "Update failed", description: error.message });
      return;
    }
    addToast({ type: "success", title: `Invoice ${status}` });
    setInvoice((prev) => prev ? { ...prev, status: status as any } : null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Invoice not found</h2>
        <Link href="/dashboard/invoices">
          <Button variant="ghost" className="mt-4">Back to invoices</Button>
        </Link>
      </div>
    );
  }

  const client = invoice.client as any;
  const items = (invoice.items ?? []) as InvoiceItem[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/invoices">
            <button className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              Issued {fmtDate(invoice.issue_date)} &middot; Due {fmtDate(invoice.due_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === "draft" && (
            <Button
              leftIcon={<Send className="h-4 w-4" />}
              onClick={() => updateStatus("sent")}
            >
              Send invoice
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "viewed") && (
            <Button
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => updateStatus("paid")}
            >
              Mark as paid
            </Button>
          )}
          <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />}>
            Print
          </Button>
        </div>
      </div>

      {/* Invoice document */}
      <Card className="overflow-hidden">
        {/* Client info */}
        <div className="flex justify-between border-b border-neutral-100 pb-6 dark:border-neutral-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Bill to</p>
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
                {[client.city, client.state, client.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Amount due</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-white">
              {fmt(Number(invoice.total))}
            </p>
            <p className="mt-1 flex items-center justify-end gap-1 text-sm text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              Due {fmtDate(invoice.due_date)}
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="mt-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Description
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400 w-24">
                  Qty
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400 w-32">
                  Unit price
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400 w-32">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => (
                    <tr key={item.id} className="border-b border-neutral-50 dark:border-neutral-800/50">
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

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span className="text-neutral-900 dark:text-white">{fmt(Number(invoice.subtotal))}</span>
            </div>
            {Number(invoice.tax_rate) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Tax ({invoice.tax_rate}%)</span>
                <span className="text-neutral-900 dark:text-white">{fmt(Number(invoice.tax_amount))}</span>
              </div>
            )}
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Discount</span>
                <span className="text-emerald-600">-{fmt(Number(invoice.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">Total</span>
              <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                {fmt(Number(invoice.total))}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/30">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Notes</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{invoice.notes}</p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
