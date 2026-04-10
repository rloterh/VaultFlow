"use client";

import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings2,
  Users,
} from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";

export function WorkspaceQuickActions() {
  return (
    <ActionMenu
      widthClassName="w-80"
      triggerLabel="Open workspace quick actions"
      triggerClassName="rounded-xl border border-transparent"
      renderTrigger={() => (
        <span className="flex items-center gap-2">
          <SearchIcon />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 sm:inline dark:border-neutral-700">
            Ctrl K
          </kbd>
        </span>
      )}
      header={
        <div className="px-1 pt-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            Quick actions
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Jump to the most important operating surfaces in VaultFlow.
          </p>
        </div>
      }
      sections={[
        {
          label: "Navigate",
          items: [
            {
              label: "Dashboard",
              description: "Open your revenue and activity overview.",
              href: "/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Invoices",
              description: "Create and manage invoice operations.",
              href: "/dashboard/invoices",
              icon: FileText,
            },
            {
              label: "Clients",
              description: "Review account relationships and billing contacts.",
              href: "/dashboard/clients",
              icon: Users,
            },
            {
              label: "Reports",
              description: "Inspect financial trends and reporting views.",
              href: "/dashboard/reports",
              icon: BarChart3,
            },
          ],
        },
        {
          label: "Workspace",
          items: [
            {
              label: "Activity log",
              description: "Review tenant-wide operational changes.",
              href: "/dashboard/activity",
              icon: Activity,
            },
            {
              label: "Settings",
              description: "Update organization profile and preferences.",
              href: "/settings",
              icon: Settings2,
            },
            {
              label: "Billing",
              description: "Manage plans, usage, and payment settings.",
              href: "/settings/billing",
              icon: CreditCard,
            },
          ],
        },
      ]}
    />
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
