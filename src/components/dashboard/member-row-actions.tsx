"use client";

import { ShieldAlert, ShieldCheck, Trash2, UserCog } from "lucide-react";
import {
  ROLE_HIERARCHY,
  canManageRole,
  type Role,
} from "@/config/roles";
import { ActionMenu } from "@/components/ui/action-menu";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import type { OrgMembership } from "@/types/auth";

interface MemberRowActionsProps {
  membership: OrgMembership;
  actorRole: Role | null;
  actorUserId?: string;
  onUpdated: () => void | Promise<void>;
}

export function MemberRowActions({
  membership,
  actorRole,
  actorUserId,
  onUpdated,
}: MemberRowActionsProps) {
  const addToast = useUIStore((s) => s.addToast);
  const isSelf = actorUserId === membership.user_id;
  const canManageMember =
    !!actorRole &&
    !isSelf &&
    membership.role !== "owner" &&
    canManageRole(actorRole, membership.role);

  if (!canManageMember) {
    return null;
  }

  async function updateRole(role: Role) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("org_memberships")
      .update({ role })
      .eq("id", membership.id);

    if (error) {
      addToast({
        type: "error",
        title: "Role update failed",
        description: error.message,
      });
      return;
    }

    addToast({
      type: "success",
      title: "Role updated",
      description: `${membership.profile?.full_name || membership.profile?.email || "Member"} is now ${role}.`,
    });
    await onUpdated();
  }

  async function deactivateMember() {
    const confirmed = window.confirm(
      `Remove ${membership.profile?.full_name || membership.profile?.email || "this member"} from the organization?`
    );

    if (!confirmed) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("org_memberships")
      .update({ is_active: false })
      .eq("id", membership.id);

    if (error) {
      addToast({
        type: "error",
        title: "Unable to remove member",
        description: error.message,
      });
      return;
    }

    addToast({
      type: "success",
      title: "Member removed",
      description: `${membership.profile?.full_name || membership.profile?.email || "Member"} no longer has workspace access.`,
    });
    await onUpdated();
  }

  const assignableRoles = ROLE_HIERARCHY.filter(
    (role) => role !== membership.role && !!actorRole && canManageRole(actorRole, role)
  );

  return (
    <ActionMenu
      triggerLabel={`Open member actions for ${membership.profile?.full_name || membership.profile?.email || "member"}`}
      sections={[
        {
          items: [
            {
              label: "Review member access",
              description: `${membership.role} · joined ${new Date(membership.joined_at).toLocaleDateString("en-GB")}`,
              icon: UserCog,
              disabled: true,
            },
          ],
        },
        {
          label: "Role changes",
          items: assignableRoles.map((role) => ({
            label: `Set role to ${role}`,
            description:
              role === "admin"
                ? "Grant organization management and billing visibility."
                : role === "manager"
                  ? "Allow operational management without full admin access."
                  : "Restrict access to standard collaboration and viewing.",
            icon: role === "admin" ? ShieldCheck : ShieldAlert,
            onSelect: () => updateRole(role),
          })),
        },
        {
          label: "Access",
          items: [
            {
              label: "Remove member",
              description: "Deactivate workspace access without deleting history.",
              icon: Trash2,
              tone: "danger",
              onSelect: deactivateMember,
            },
          ],
        },
      ]}
    />
  );
}
