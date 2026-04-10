"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Mail,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { ClientRowActions } from "@/components/dashboard/client-row-actions";
import { Avatar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import type { Client } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ClientsPage() {
  const { currentOrg } = useOrgStore();
  const addToast = useUIStore((s) => s.addToast);
  const [clients, setClients] = useState<Client[]>([]);
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

  const fetchClients = useCallback(async () => {
    if (!currentOrg) {
      return;
    }

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

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentOrg) {
      return;
    }

    setSaving(true);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.from("clients").insert({
      org_id: currentOrg.id,
      name: clientForm.name,
      email: clientForm.email,
      company: clientForm.company || null,
      city: clientForm.city || null,
      country: clientForm.country,
    });

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
    return {
      total: clients.length,
      revenue: clients.reduce(
        (sum, client) => sum + Number(client.total_revenue),
        0
      ),
      avgRevenue:
        clients.length > 0
          ? clients.reduce((sum, client) => sum + Number(client.total_revenue), 0) /
            clients.length
          : 0,
    };
  }, [clients]);

  const columns: Column<Client>[] = [
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
            "—"
          )}
        </span>
      ),
    },
    {
      key: "invoice_count",
      header: "Invoices",
      sortable: true,
      width: "100px",
      render: (row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {row.invoice_count}
        </span>
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
            Manage account relationships, revenue concentration, and billing contacts.
          </p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setComposerOpen((current) => !current)}
        >
          {composerOpen ? "Close form" : "Add client"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Active accounts
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {metrics.total}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Clients currently in the operating roster.</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Lifetime revenue
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {fmt(metrics.revenue)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Total revenue concentration across this workspace.</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Average account value
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {fmt(metrics.avgRevenue)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Helpful signal for segmenting enterprise follow-up.</p>
        </Card>
      </div>

      {composerOpen && (
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
                setClientForm((current) => ({ ...current, country: event.target.value.toUpperCase() }))
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
            onAction={() => setComposerOpen(true)}
          />
        }
      />
    </motion.div>
  );
}
