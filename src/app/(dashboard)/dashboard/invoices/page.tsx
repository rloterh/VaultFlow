"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useOrgStore } from "@/stores/org-store";
import { useInvoiceRealtime } from "@/lib/supabase/realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Invoice, InvoiceStatus } from "@/types/database";

const statuses: { label: string; value: InvoiceStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function InvoicesPage() {
  const router = useRouter();
  const { currentOrg } = useOrgStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");

  const fetchInvoices = useCallback(async () => {
    if (!currentOrg) return;
    const sb = getSupabaseBrowserClient();
    let query = sb
      .from("invoices")
      .select("*, client:clients(id, name, email, company)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });

    if (status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("invoice_number", `%${search}%`);

    const { data } = await query;
    setInvoices((data ?? []) as Invoice[]);
    setLoading(false);
  }, [currentOrg, status, search]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useInvoiceRealtime(currentOrg?.id, fetchInvoices);

  const columns: Column<Invoice>[] = [
    {
      key: "invoice_number",
      header: "Invoice",
      sortable: true,
      width: "160px",
      render: (row) => (
        <Link href={`/dashboard/invoices/${row.id}`} className="font-medium text-neutral-900 hover:underline dark:text-white">
          {row.invoice_number}
        </Link>
      ),
    },
    {
      key: "client",
      header: "Client",
      sortable: false,
      render: (row) => (
        <div>
          <p className="text-neutral-900 dark:text-white">{(row.client as any)?.name ?? "—"}</p>
          <p className="text-xs text-neutral-500">{(row.client as any)?.company ?? ""}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "120px",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "issue_date",
      header: "Date",
      sortable: true,
      width: "130px",
      render: (row) => <span className="text-neutral-600 dark:text-neutral-400">{fmtDate(row.issue_date)}</span>,
    },
    {
      key: "due_date",
      header: "Due",
      sortable: true,
      width: "130px",
      render: (row) => {
        const overdue = new Date(row.due_date) < new Date() && row.status !== "paid";
        return (
          <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : "text-neutral-600 dark:text-neutral-400"}>
            {fmtDate(row.due_date)}
          </span>
        );
      },
    },
    {
      key: "total",
      header: "Amount",
      sortable: true,
      width: "120px",
      render: (row) => (
        <span className="font-medium text-neutral-900 dark:text-white">{fmt(Number(row.total))}</span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Invoices</h1>
          <p className="mt-1 text-sm text-neutral-500">Create, track, and manage your invoices.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />}>Create invoice</Button>
      </div>

      <DataTable
        data={invoices}
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
            description="Create your first invoice to start tracking revenue."
            actionLabel="Create invoice"
            onAction={() => router.push("/dashboard/invoices")}
          />
        }
        toolbar={
          <div className="flex items-center gap-1">
            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={() => { setStatus(s.value); setLoading(true); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === s.value
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
      />
    </motion.div>
  );
}
