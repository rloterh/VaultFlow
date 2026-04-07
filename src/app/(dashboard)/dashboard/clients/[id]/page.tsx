"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Mail, Phone, MapPin, Building2,
  FileText, DollarSign, Calendar,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, Skeleton } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Client, Invoice } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const sb = getSupabaseBrowserClient();
      const [cRes, iRes] = await Promise.all([
        sb.from("clients").select("*").eq("id", id).single(),
        sb.from("invoices").select("*").eq("client_id", id).order("issue_date", { ascending: false }),
      ]);
      setClient(cRes.data as Client | null);
      setInvoices((iRes.data ?? []) as Invoice[]);
      setLoading(false);
    }
    if (id) fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Client not found</h2>
        <Link href="/dashboard/clients"><Button variant="ghost" className="mt-4">Back to clients</Button></Link>
      </div>
    );
  }

  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const pendingTotal = invoices.filter((i) => ["sent", "viewed"].includes(i.status)).reduce((s, i) => s + Number(i.total), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clients">
          <button className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <Avatar name={client.name} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{client.name}</h1>
          {client.company && (
            <p className="flex items-center gap-1.5 text-sm text-neutral-500">
              <Building2 className="h-3.5 w-3.5" />{client.company}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Revenue" value={fmt(paidTotal)} icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" index={0} />
        <MetricCard label="Pending" value={fmt(pendingTotal)} icon={FileText} iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" index={1} />
        <MetricCard label="Invoices" value={String(invoices.length)} icon={Calendar} iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" index={2} />
      </div>

      {/* Contact info */}
      <Card>
        <CardTitle>Contact information</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-neutral-400" />
            <span className="text-neutral-700 dark:text-neutral-300">{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-neutral-400" />
              <span className="text-neutral-700 dark:text-neutral-300">{client.phone}</span>
            </div>
          )}
          {client.city && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-neutral-400" />
              <span className="text-neutral-700 dark:text-neutral-300">
                {[client.address_line1, client.city, client.state, client.country].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Invoice history */}
      <Card padding="none">
        <div className="p-5 pb-0">
          <CardTitle>Invoice history</CardTitle>
        </div>
        <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
          {invoices.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-400">No invoices for this client</p>
          ) : (
            invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/dashboard/invoices/${inv.id}`}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{inv.invoice_number}</p>
                  <p className="text-xs text-neutral-500">{fmtDate(inv.issue_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">{fmt(Number(inv.total))}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </motion.div>
  );
}
