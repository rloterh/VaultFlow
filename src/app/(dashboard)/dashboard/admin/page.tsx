"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { MemberRowActions } from "@/components/dashboard/member-row-actions";
import { RolePolicyMatrix } from "@/components/dashboard/role-policy-matrix";
import { Avatar, Badge, Skeleton } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { ROLE_METADATA, hasMinRole } from "@/config/roles";
import { useAuth } from "@/hooks/use-auth";
import {
  buildGovernanceWorkspaceSummary,
  isBillingControlActivityAction,
  isGovernanceActivityAction,
} from "@/lib/admin/governance";
import {
  getActivityLabel,
  getActivitySubject,
  getActivityTone,
} from "@/lib/activity/presentation";
import { buildWorkflowAccountabilityMap } from "@/lib/operations/accountability";
import { fetchVendorAssignmentsForOrg } from "@/lib/rbac/vendor-access";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import type { OrgMembership } from "@/types/auth";
import type { Invoice, VendorClientAssignment } from "@/types/database";

type PendingInvite = {
  id: string;
  email: string;
  role: OrgMembership["role"];
  expires_at: string;
  created_at: string;
};

type AdminInvoice = {
  id: string;
  invoice_number: string;
  status: Invoice["status"];
  total: number;
  amount_paid: number;
  due_date: string;
  last_payment_failed_at?: string | null;
  last_recovery_reviewed_at?: string | null;
  voided_at?: string | null;
  client?: { name?: string | null } | null;
};

type AuditEntry = {
  id: string;
  org_id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: { full_name: string | null; email: string | null } | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toneBadgeVariant(tone: "success" | "warning" | "danger" | "info") {
  return tone;
}

function AdminContent() {
  const { currentOrg, currentRole } = useOrgStore();
  const { user } = useAuth();
  const [members, setMembers] = useState<OrgMembership[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [vendorAssignments, setVendorAssignments] = useState<VendorClientAssignment[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [workflowAccountability, setWorkflowAccountability] = useState<
    Map<string, { ownerName: string | null; lastTouchedAt: string | null }>
  >(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrg) {
      return;
    }

    setLoading(true);
    const sb = getSupabaseBrowserClient();
    const [
      membersRes,
      invoicesRes,
      clientsRes,
      invitesRes,
      assignmentsRes,
      auditRes,
      workflowRes,
    ] = await Promise.all([
      sb
        .from("org_memberships")
        .select("*, profile:profiles(*)")
        .eq("org_id", currentOrg.id)
        .eq("is_active", true),
      sb
        .from("invoices")
        .select("id, invoice_number, status, total, amount_paid, due_date, last_payment_failed_at, last_recovery_reviewed_at, voided_at, client:clients(name)")
        .eq("org_id", currentOrg.id),
      sb
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("is_active", true),
      sb
        .from("org_invites")
        .select("id, email, role, expires_at, created_at")
        .eq("org_id", currentOrg.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      fetchVendorAssignmentsForOrg(sb, currentOrg.id),
      sb
        .from("activity_log")
        .select("id, org_id, user_id, entity_type, entity_id, action, metadata, created_at, profile:profiles(full_name, email)")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(24),
      sb
        .from("activity_log")
        .select("entity_id, action, created_at, profile:profiles(full_name)")
        .eq("org_id", currentOrg.id)
        .eq("entity_type", "invoice")
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    const normalizedInvoices = ((invoicesRes.data ?? []) as Array<
      Omit<AdminInvoice, "client"> & { client?: { name?: string | null }[] | { name?: string | null } | null }
    >).map((invoice) => ({
      ...invoice,
      client: Array.isArray(invoice.client) ? invoice.client[0] ?? null : invoice.client ?? null,
    }));

    setMembers((membersRes.data ?? []) as OrgMembership[]);
    setInvoices(normalizedInvoices);
    setPendingInvites((invitesRes.data ?? []) as PendingInvite[]);
    setVendorAssignments(assignmentsRes);
    setRecentAudit((auditRes.data ?? []) as AuditEntry[]);
    setClientCount(clientsRes.count ?? 0);

    const workflowEntries =
      ((workflowRes.data ?? []) as Array<{
        entity_id: string;
        action: string;
        created_at: string;
        profile?: { full_name: string | null }[] | { full_name: string | null } | null;
      }>).map((entry) => ({
        ...entry,
        profile: Array.isArray(entry.profile) ? entry.profile[0] ?? null : entry.profile ?? null,
      }));

    setWorkflowAccountability(buildWorkflowAccountabilityMap(workflowEntries));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const revenue = invoices
      .filter((invoice) => invoice.status === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);

    return {
      members: members.length,
      invoices: invoices.length,
      revenue,
      clients: clientCount,
      admins: members.filter((member) => ["owner", "admin"].includes(member.role)).length,
      operationalLeads: members.filter((member) => hasMinRole(member.role, "manager")).length,
      restrictedSeats: members.filter((member) => ["vendor", "viewer"].includes(member.role)).length,
    };
  }, [clientCount, invoices, members]);

  const governanceSummary = useMemo(
    () =>
      buildGovernanceWorkspaceSummary({
        organization: currentOrg,
        members,
        invites: pendingInvites,
        invoices,
        vendorAssignments,
        workflowAccountability,
      }),
    [currentOrg, invoices, members, pendingInvites, vendorAssignments, workflowAccountability]
  );

  const recentControlEvents = useMemo(
    () =>
      recentAudit.filter(
        (entry) =>
          isGovernanceActivityAction(entry.action, entry.entity_type) ||
          isBillingControlActivityAction(entry.action, entry.entity_type) ||
          entry.action === "invoice.recovery_reviewed"
      ),
    [recentAudit]
  );

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
              {row.profile?.full_name || "No name on file"}
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
        <div className="space-y-1">
          <Badge variant={ROLE_METADATA[row.role].badgeVariant}>{row.role}</Badge>
          <p className="text-xs text-neutral-400">{ROLE_METADATA[row.role].title}</p>
        </div>
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
          orgId={currentOrg?.id}
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
          Governance, audit continuity, and workspace control from one operating surface.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-lg font-bold text-white">
                {currentOrg?.name.charAt(0)}
              </div>
              <div>
                <CardTitle>{currentOrg?.name}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={currentOrg?.plan === "free" ? "outline" : "success"}>
                    {currentOrg?.plan} plan
                  </Badge>
                  <span className="text-xs text-neutral-400">Slug: {currentOrg?.slug}</span>
                </div>
              </div>
            </div>
            <Badge variant={toneBadgeVariant(governanceSummary.banner.tone)}>
              {governanceSummary.banner.tone === "danger"
                ? "Needs intervention"
                : governanceSummary.banner.tone === "warning"
                  ? "Monitor closely"
                  : governanceSummary.banner.tone === "info"
                    ? "Review recommended"
                    : "Healthy"}
            </Badge>
          </div>
          <div className="mt-6 rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {governanceSummary.banner.title}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              {governanceSummary.banner.detail}
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Governance
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                {stats.admins} privileged admin seat{stats.admins === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Owners and admins with billing, access control, and governance authority.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Oversight queue
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                {governanceSummary.moderationQueue.length} active item{governanceSummary.moderationQueue.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Invite hygiene, billing recovery, and assignment gaps roll up here first.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/30">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Next step
              </p>
              <Link
                href="/dashboard/activity"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
              >
                Open audit log
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-1 text-xs text-neutral-500">
                Use the activity surface to confirm follow-through after each governance action.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-neutral-400" />
            <CardTitle>Control surfaces</CardTitle>
          </div>
          <CardDescription>
            Jump directly into the correct workspace for billing, audit, or access operations.
          </CardDescription>
          <div className="mt-5 space-y-3 text-sm">
            {[
              {
                href: "/settings/team",
                title: "Team access controls",
                detail: "Invite, scope, and role-manage operator seats.",
              },
              {
                href: "/settings/billing",
                title: "Billing control center",
                detail: "Review payment recovery and subscription posture.",
              },
              {
                href: "/dashboard/activity",
                title: "Audit log",
                detail: "Confirm that privileged and finance actions remain reviewable.",
              },
              {
                href: "/dashboard/reports",
                title: "Reporting surface",
                detail: "Validate operational trends after billing or access changes.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl border border-neutral-200/70 p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60"
              >
                <p className="font-medium text-neutral-900 dark:text-white">{item.title}</p>
                <p className="mt-1 text-neutral-500">{item.detail}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="Team members"
          value={String(stats.members)}
          icon={Users}
          iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
          index={0}
        />
        <MetricCard
          label="Total revenue"
          value={fmt(stats.revenue)}
          icon={CreditCard}
          iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          index={1}
        />
        <MetricCard
          label="Governance items"
          value={String(governanceSummary.moderationQueue.length)}
          icon={ShieldAlert}
          iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          index={2}
        />
        <MetricCard
          label="Restricted seats"
          value={String(stats.restrictedSeats)}
          icon={Building2}
          iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
          index={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {governanceSummary.postureCards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{card.label}</CardTitle>
              <Badge variant={toneBadgeVariant(card.tone)}>{card.value}</Badge>
            </div>
            <p className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
              {card.value}
            </p>
            <CardDescription className="mt-2">{card.detail}</CardDescription>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Moderation queue</CardTitle>
              <CardDescription>
                Priority governance and billing-control gaps that need operator attention.
              </CardDescription>
            </div>
            <Badge variant="outline">
              {governanceSummary.moderationQueue.length} open
            </Badge>
          </div>
          <div className="mt-5 space-y-3">
            {governanceSummary.moderationQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
                No active governance blockers right now. Keep using the audit log to verify ongoing discipline.
              </div>
            ) : (
              governanceSummary.moderationQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {item.title}
                        </p>
                        <Badge variant={toneBadgeVariant(item.tone)}>{item.tone}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">{item.detail}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="shrink-0 text-sm font-medium text-neutral-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                    >
                      {item.actionLabel}
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Audit continuity</CardTitle>
          <CardDescription>
            Recent control-plane events worth validating after admin, billing, or recovery work.
          </CardDescription>
          <div className="mt-5 space-y-3">
            {recentControlEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
                Recent governance and billing control actions will appear here once they are recorded.
              </div>
            ) : (
              recentControlEvents.slice(0, 6).map((entry) => {
                const tone = getActivityTone(entry.action);
                const actorName =
                  entry.profile?.full_name || entry.profile?.email || "System";

                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {getActivityLabel(entry.action)}
                          </p>
                          {tone && <Badge variant={tone}>{entry.entity_type}</Badge>}
                        </div>
                        <p className="mt-2 text-sm text-neutral-500">
                          {actorName} on {getActivitySubject(entry)}
                        </p>
                      </div>
                      <span className="text-xs text-neutral-400">
                        {formatRelativeTime(entry.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <RolePolicyMatrix currentRole={currentRole} compact />
        <Card>
          <CardTitle>Access posture</CardTitle>
          <CardDescription>
            Keep invite, privilege, and team structure aligned with how the workspace actually operates.
          </CardDescription>
          <div className="mt-5 space-y-4 text-sm">
            <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
              <p className="font-medium text-neutral-900 dark:text-white">
                {governanceSummary.counts.pendingInvites} invite{governanceSummary.counts.pendingInvites === 1 ? "" : "s"} pending
              </p>
              <p className="mt-1 text-neutral-500">
                {governanceSummary.counts.expiredInvites > 0
                  ? `${governanceSummary.counts.expiredInvites} invite${governanceSummary.counts.expiredInvites === 1 ? "" : "s"} are already expired.`
                  : "Invite hygiene is currently under control."}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
              <p className="font-medium text-neutral-900 dark:text-white">
                {stats.operationalLeads} operational lead seat{stats.operationalLeads === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-neutral-500">
                Managers and finance managers keep day-to-day operations moving without full admin blast radius.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/70 p-4 dark:border-neutral-800">
              <p className="font-medium text-neutral-900 dark:text-white">
                {governanceSummary.counts.vendorsWithoutAssignments} vendor seat{governanceSummary.counts.vendorsWithoutAssignments === 1 ? "" : "s"} need scope
              </p>
              <p className="mt-1 text-neutral-500">
                Vendor visibility should stay assignment-backed to avoid broad accidental exposure.
              </p>
            </div>
            <Link
              href="/settings/team"
              className="inline-flex text-sm font-medium text-neutral-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
            >
              Open team lifecycle controls
            </Link>
          </div>
        </Card>
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
