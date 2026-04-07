"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Building2, Users, CreditCard, MoreHorizontal } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge, Avatar, Skeleton } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AuthGuard } from "@/components/auth/auth-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import type { OrgMembership } from "@/types/auth";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function AdminContent() {
  const { currentOrg } = useOrgStore();
  const [members, setMembers] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ members: 0, invoices: 0, revenue: 0, clients: 0 });

  useEffect(() => {
    async function fetch() {
      if (!currentOrg) return;
      const sb = getSupabaseBrowserClient();

      const [membersRes, invoicesRes, clientsRes] = await Promise.all([
        sb.from("org_memberships").select("*, profile:profiles(*)").eq("org_id", currentOrg.id).eq("is_active", true),
        sb.from("invoices").select("total, status").eq("org_id", currentOrg.id),
        sb.from("clients").select("*", { count: "exact", head: true }).eq("org_id", currentOrg.id).eq("is_active", true),
      ]);

      const mems = (membersRes.data ?? []) as OrgMembership[];
      setMembers(mems);

      const invoices = invoicesRes.data ?? [];
      const revenue = invoices
        .filter((i: any) => i.status === "paid")
        .reduce((s: number, i: any) => s + Number(i.total), 0);

      setStats({
        members: mems.length,
        invoices: invoices.length,
        revenue,
        clients: clientsRes.count ?? 0,
      });
      setLoading(false);
    }
    fetch();
  }, [currentOrg]);

  const roleBadgeVariant: Record<string, "info" | "success" | "warning" | "default"> = {
    owner: "info", admin: "success", manager: "warning", member: "default",
  };

  const columns: Column<OrgMembership>[] = [
    {
      key: "name",
      header: "Member",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.profile?.full_name} src={row.profile?.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-neutral-900 dark:text-white">{row.profile?.full_name || "—"}</p>
            <p className="text-xs text-neutral-500">{row.profile?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      width: "120px",
      render: (row) => <Badge variant={roleBadgeVariant[row.role] ?? "default"}>{row.role}</Badge>,
    },
    {
      key: "joined_at",
      header: "Joined",
      sortable: true,
      width: "140px",
      render: (row) => (
        <span className="text-sm text-neutral-500">
          {new Date(row.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "50px",
      render: () => (
        <button className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Admin panel</h1>
        </div>
        <p className="mt-1 text-sm text-neutral-500">Organization overview and management.</p>
      </div>

      {/* Org info */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">
            {currentOrg?.name.charAt(0)}
          </div>
          <div>
            <CardTitle>{currentOrg?.name}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={currentOrg?.plan === "free" ? "default" : "success"}>
                {currentOrg?.plan} plan
              </Badge>
              <span className="text-xs text-neutral-400">Slug: {currentOrg?.slug}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Team Members" value={String(stats.members)} icon={Users} iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" index={0} />
        <MetricCard label="Total Revenue" value={fmt(stats.revenue)} icon={CreditCard} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" index={1} />
        <MetricCard label="Invoices" value={String(stats.invoices)} icon={Building2} iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" index={2} />
        <MetricCard label="Clients" value={String(stats.clients)} icon={Users} iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" index={3} />
      </div>

      <DataTable
        data={members}
        columns={columns}
        searchPlaceholder="Search members..."
        pageSize={20}
      />
    </motion.div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard minRole="admin">
      <AdminContent />
    </AuthGuard>
  );
}
