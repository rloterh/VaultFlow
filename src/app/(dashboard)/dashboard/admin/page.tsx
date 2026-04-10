"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { MemberRowActions } from "@/components/dashboard/member-row-actions";
import { Badge, Avatar, Skeleton } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import type { OrgMembership } from "@/types/auth";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

function AdminContent() {
  const { currentOrg, currentRole } = useOrgStore();
  const { user } = useAuth();
  const [members, setMembers] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    members: 0,
    invoices: 0,
    revenue: 0,
    clients: 0,
    admins: 0,
    pendingInvites: 0,
  });

  const fetchData = useCallback(async () => {
    if (!currentOrg) {
      return;
    }

    const sb = getSupabaseBrowserClient();
    const [membersRes, invoicesRes, clientsRes, invitesRes] = await Promise.all([
      sb
        .from("org_memberships")
        .select("*, profile:profiles(*)")
        .eq("org_id", currentOrg.id)
        .eq("is_active", true),
      sb.from("invoices").select("total, status").eq("org_id", currentOrg.id),
      sb
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("is_active", true),
      sb
        .from("org_invites")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("status", "pending"),
    ]);

    const activeMembers = (membersRes.data ?? []) as OrgMembership[];
    const invoices = invoicesRes.data ?? [];
    const revenue = invoices
      .filter((invoice: { status: string }) => invoice.status === "paid")
      .reduce(
        (sum: number, invoice: { total: string | number }) =>
          sum + Number(invoice.total),
        0
      );

    setMembers(activeMembers);
    setStats({
      members: activeMembers.length,
      invoices: invoices.length,
      revenue,
      clients: clientsRes.count ?? 0,
      admins: activeMembers.filter((member) =>
        ["owner", "admin"].includes(member.role)
      ).length,
      pendingInvites: invitesRes.count ?? 0,
    });
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const roleBadgeVariant: Record<
    string,
    "info" | "success" | "warning" | "default"
  > = {
    owner: "info",
    admin: "success",
    manager: "warning",
    member: "default",
  };

  const columns: Column<OrgMembership>[] = [
    {
      key: "name",
      header: "Member",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={row.profile?.full_name}
            src={row.profile?.avatar_url}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900 dark:text-white">
              {row.profile?.full_name || "—"}
            </p>
            <p className="truncate text-xs text-neutral-500">{row.profile?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      width: "120px",
      render: (row) => (
        <Badge variant={roleBadgeVariant[row.role] ?? "default"}>{row.role}</Badge>
      ),
    },
    {
      key: "joined_at",
      header: "Joined",
      sortable: true,
      width: "140px",
      render: (row) => (
        <span className="text-sm text-neutral-500">
          {new Date(row.joined_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (row) => (
        <MemberRowActions
          membership={row}
          actorRole={currentRole}
          actorUserId={user?.id}
          onUpdated={fetchData}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
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
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Admin panel
          </h1>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Organization oversight, access controls, and workspace governance.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-lg font-bold text-white">
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
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Governance
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                {stats.admins} privileged admins
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Owners and admins with billing and access control privileges.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Onboarding
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                {stats.pendingInvites} pending invite{stats.pendingInvites === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Keep outstanding invitations tight and role assignments deliberate.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Next step
              </p>
              <Link
                href="/settings/team"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
              >
                Open team controls
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-1 text-xs text-neutral-500">
                Continue invite, role, and access lifecycle management there.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-neutral-400" />
            <CardTitle>Operational posture</CardTitle>
          </div>
          <CardDescription>
            Core commercial signals for this tenant workspace.
          </CardDescription>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/40">
              <span className="text-sm text-neutral-500">Plan</span>
              <span className="text-sm font-medium text-neutral-900 capitalize dark:text-white">
                {currentOrg?.plan}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/40">
              <span className="text-sm text-neutral-500">Billing</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                {currentOrg?.stripe_subscription_id ? "Active subscription" : "Free tier"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/40">
              <span className="text-sm text-neutral-500">Active clients</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                {stats.clients}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="Team Members"
          value={String(stats.members)}
          icon={Users}
          iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          index={0}
        />
        <MetricCard
          label="Total Revenue"
          value={fmt(stats.revenue)}
          icon={CreditCard}
          iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          index={1}
        />
        <MetricCard
          label="Invoices"
          value={String(stats.invoices)}
          icon={Building2}
          iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
          index={2}
        />
        <MetricCard
          label="Privileged admins"
          value={String(stats.admins)}
          icon={Shield}
          iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          index={3}
        />
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
