"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Clock3, Mail, UserPlus } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { MemberRowActions } from "@/components/dashboard/member-row-actions";
import { RolePolicyMatrix } from "@/components/dashboard/role-policy-matrix";
import { Badge, Avatar, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import { ROLE_HIERARCHY, ROLE_METADATA, hasMinRole, type Role } from "@/config/roles";

type PendingInvite = {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
};

function formatInviteDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TeamContent() {
  const { currentOrg, currentRole, members, isLoading, fetchMembers } = useOrgStore();
  const { user } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ email: string; role: Role }>({
    email: "",
    role: "member",
  });
  const expiringInvites = pendingInvites.filter((invite) => {
    const msUntilExpiry = new Date(invite.expires_at).getTime() - Date.now();
    return msUntilExpiry > 0 && msUntilExpiry <= 1000 * 60 * 60 * 24 * 3;
  }).length;
  const operationalLeads = members.filter((member) => hasMinRole(member.role, "manager")).length;
  const financeManagers = members.filter((member) => member.role === "finance_manager").length;
  const restrictedSeats = members.filter((member) => ["vendor", "viewer"].includes(member.role)).length;
  const inviteableRoles = ROLE_HIERARCHY.slice().reverse().filter((role) => role !== "owner");

  const fetchData = useCallback(async () => {
    if (!currentOrg) {
      return;
    }

    await fetchMembers();
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("org_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("org_id", currentOrg.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPendingInvites((data ?? []) as PendingInvite[]);
  }, [currentOrg, fetchMembers]);

  useEffect(() => {
    if (currentOrg) {
      void fetchData();
    }
  }, [currentOrg, fetchData]);

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentOrg || !user) {
      return;
    }

    setInviteLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("org_invites").insert({
      org_id: currentOrg.id,
      email: inviteForm.email.toLowerCase(),
      role: inviteForm.role,
      invited_by: user.id,
    });

    if (error) {
      addToast({
        type: "error",
        title: "Invite failed",
        description: error.message,
      });
      setInviteLoading(false);
      return;
    }

    addToast({
      type: "success",
      title: "Invite created",
      description: `An invitation for ${inviteForm.email} is ready to be sent.`,
    });
    setInviteForm({ email: "", role: "member" });
    setInviteLoading(false);
    await fetchData();
  }

  async function revokeInvite(inviteId: string, email: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("org_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      addToast({
        type: "error",
        title: "Invite revocation failed",
        description: error.message,
      });
      return;
    }

    addToast({
      type: "success",
      title: "Invite revoked",
      description: `${email} no longer has a pending invitation.`,
    });
    await fetchData();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-4xl space-y-8"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Team</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage access, pending invites, and member roles for {currentOrg?.name ?? "your organization"}.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white/70 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
          <p className="font-medium text-neutral-900 dark:text-white">
            {members.length} active members
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {pendingInvites.length} pending invite{pendingInvites.length === 1 ? "" : "s"} · {currentRole} access
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-neutral-400" />
            <CardTitle>Invite teammate</CardTitle>
          </div>
          <CardDescription>
            Provision access deliberately. New members inherit only the role you assign here.
          </CardDescription>
          <form onSubmit={handleInviteSubmit} className="mt-6 space-y-4">
            <Input
              type="email"
              label="Work email"
              placeholder="finance@company.com"
              value={inviteForm.email}
              onChange={(event) =>
                setInviteForm((current) => ({ ...current, email: event.target.value }))
              }
              required
              leftIcon={<Mail className="h-4 w-4" />}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Role
              </label>
              <select
                value={inviteForm.role}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: event.target.value as Role,
                  }))
                }
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              >
                {inviteableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_METADATA[role].title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" isLoading={inviteLoading} leftIcon={<UserPlus className="h-4 w-4" />}>
                Create invite
              </Button>
            </div>
          </form>
        </Card>

        <Card padding="none">
          <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
            <CardTitle className="text-base">Pending invitations</CardTitle>
            <CardDescription>Outstanding seats waiting for acceptance.</CardDescription>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {pendingInvites.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-neutral-500">
                No pending invites right now.
              </div>
            ) : (
              pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {invite.email}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <Badge variant={ROLE_METADATA[invite.role].badgeVariant}>{invite.role}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        Expires {formatInviteDate(invite.expires_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => revokeInvite(invite.id, invite.email)}
                  >
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Invite pressure
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {expiringInvites}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Pending invites expiring within the next 72 hours.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Operator leads
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {operationalLeads}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Seats with operational ownership or governance authority.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Finance managers
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {financeManagers}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Dedicated billing and reporting operators without people-admin authority.
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Restricted seats
          </p>
          <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
            {restrictedSeats}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Vendor and viewer roles with intentionally narrower workspace access.
          </p>
        </Card>
      </div>

      <RolePolicyMatrix currentRole={currentRole} />

      <Card padding="none">
        <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
          <CardTitle className="text-base">Member access</CardTitle>
          <CardDescription>
            Review every active seat, then promote, restrict, or remove access in place.
          </CardDescription>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              No team members yet. Invite someone to get started.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={member.profile?.full_name}
                    src={member.profile?.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {member.profile?.full_name || "Unnamed"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{member.profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge variant={ROLE_METADATA[member.role].badgeVariant}>{member.role}</Badge>
                    <p className="mt-1 text-xs text-neutral-400">
                      {ROLE_METADATA[member.role].title}
                    </p>
                  </div>
                  <MemberRowActions
                    membership={member}
                    actorRole={currentRole}
                    actorUserId={user?.id}
                    onUpdated={fetchData}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function TeamPage() {
  return (
    <AuthGuard minRole="admin">
      <TeamContent />
    </AuthGuard>
  );
}
