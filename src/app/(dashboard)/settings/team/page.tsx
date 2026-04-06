"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, MoreHorizontal } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Avatar, Skeleton } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useOrgStore } from "@/stores/org-store";
import type { Role } from "@/config/roles";

const roleBadgeVariant: Record<Role, "info" | "success" | "warning" | "default"> = {
  owner: "info",
  admin: "success",
  manager: "warning",
  member: "default",
};

function TeamContent() {
  const { currentOrg, members, isLoading, fetchMembers } = useOrgStore();

  useEffect(() => {
    if (currentOrg) fetchMembers();
  }, [currentOrg, fetchMembers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Team</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage members and roles for {currentOrg?.name ?? "your organization"}.
          </p>
        </div>
        <Button leftIcon={<UserPlus className="h-4 w-4" />}>Invite member</Button>
      </div>

      <Card padding="none">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
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
                className="flex items-center justify-between p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={member.profile?.full_name}
                    src={member.profile?.avatar_url}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {member.profile?.full_name || "Unnamed"}
                    </p>
                    <p className="text-xs text-neutral-500">{member.profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={roleBadgeVariant[member.role]}>
                    {member.role}
                  </Badge>
                  <button className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
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
