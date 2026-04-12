"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, CreditCard, LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import { ActionMenu, type ActionMenuSection } from "@/components/ui/action-menu";
import { Avatar } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";

function planLabel(plan: string | undefined) {
  if (!plan) return "Workspace";
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`;
}

export function UserMenu() {
  const router = useRouter();
  const { profile, memberships, currentOrg, currentRole, signOut } = useAuth();
  const { can } = usePermissions();
  const switchOrg = useOrgStore((s) => s.switchOrg);
  const addToast = useUIStore((s) => s.addToast);

  const orgSections: ActionMenuSection[] = [
    {
      label: "Switch organization",
      items: memberships
        .filter((membership) => membership.organization)
        .map((membership) => ({
          label: membership.organization?.name ?? "Workspace",
          description: `${membership.role} - ${planLabel(membership.organization?.plan)}`,
          checked: currentOrg?.id === membership.org_id,
          onSelect: () => {
            switchOrg(membership.org_id, memberships);
            addToast({
              type: "success",
              title: "Workspace switched",
              description: `Now viewing ${membership.organization?.name}.`,
            });
          },
        })),
    },
    {
      label: "Workspace",
      items: [
        {
          label: "Open dashboard",
          description: "Jump back to your overview workspace.",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          label: "Organization settings",
          description: "Update profile, org details, and preferences.",
          href: "/settings",
          icon: Settings2,
        },
        {
          label: "Billing and plan",
          description: "Review subscription, usage, and payment settings.",
          href: "/settings/billing",
          icon: CreditCard,
          hidden: !can("org:billing"),
        },
      ].filter((item) => !item.hidden),
    },
    {
      items: [
        {
          label: "Sign out",
          description: "End this session on the current device.",
          icon: LogOut,
          tone: "danger",
          onSelect: async () => {
            try {
              await signOut();
              router.replace("/login");
            } catch (error) {
              addToast({
                type: "error",
                title: "Unable to sign out",
                description:
                  error instanceof Error
                    ? error.message
                    : "Please try again in a moment.",
              });
            }
          },
        },
      ],
    },
  ];

  return (
    <ActionMenu
      sections={orgSections}
      widthClassName="w-80"
      triggerLabel="Open user menu"
      triggerClassName="rounded-xl border border-neutral-200 bg-white/80 px-2.5 py-1.5 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/80 dark:hover:bg-neutral-900"
      header={
        <div className="flex items-center gap-3 px-1 pt-1">
          <Avatar name={profile?.full_name} src={profile?.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {profile?.full_name || "VaultFlow user"}
            </p>
            <p className="truncate text-xs text-neutral-500">{profile?.email}</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-neutral-400">
              <span>{currentRole ?? "member"}</span>
              <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <span>{planLabel(currentOrg?.plan)}</span>
            </div>
          </div>
        </div>
      }
      renderTrigger={(open) => (
        <span className="flex items-center gap-2">
          <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
          <span className="hidden min-w-0 text-left md:block">
            <span className="block truncate text-sm font-medium text-neutral-900 dark:text-white">
              {profile?.full_name || "Account"}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {currentOrg?.name ?? "No workspace"}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      )}
    />
  );
}
