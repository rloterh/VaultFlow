"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Users, Building2, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useOrgStore } from "@/stores/org-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Client } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

export default function ClientsPage() {
  const { currentOrg } = useOrgStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!currentOrg) return;
    const sb = getSupabaseBrowserClient();
    const { data } = await sb
      .from("clients")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("is_active", true)
      .order("total_revenue", { ascending: false });
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const columns: Column<Client>[] = [
    {
      key: "name",
      header: "Client",
      sortable: true,
      render: (row) => (
        <Link href={`/dashboard/clients/${row.id}`} className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div>
            <p className="font-medium text-neutral-900 hover:underline dark:text-white">{row.name}</p>
            {row.company && (
              <p className="flex items-center gap-1 text-xs text-neutral-500">
                <Building2 className="h-3 w-3" />{row.company}
              </p>
            )}
          </div>
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
          <Mail className="h-3.5 w-3.5 text-neutral-400" />{row.email}
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
            <><MapPin className="h-3.5 w-3.5" />{row.city}, {row.country}</>
          ) : "—"}
        </span>
      ),
    },
    {
      key: "invoice_count",
      header: "Invoices",
      sortable: true,
      width: "100px",
      render: (row) => (
        <span className="text-neutral-600 dark:text-neutral-400">{row.invoice_count}</span>
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
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Clients</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage your client relationships.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />}>Add client</Button>
      </div>

      <DataTable
        data={clients}
        columns={columns}
        searchPlaceholder="Search clients..."
        searchKey="name"
        pageSize={10}
        isLoading={loading}
        emptyState={
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to start sending invoices."
            actionLabel="Add client"
            onAction={() => {}}
          />
        }
      />
    </motion.div>
  );
}
