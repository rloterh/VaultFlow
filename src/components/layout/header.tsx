"use client";

import { usePathname } from "next/navigation";
import { Building2, Menu } from "lucide-react";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { WorkspaceQuickActions } from "@/components/layout/workspace-quick-actions";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/stores/ui-store";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    isLast: index === segments.length - 1,
  }));
}

export function Header() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { currentOrg, currentRole } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/80 px-4 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80 sm:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden dark:hover:bg-neutral-800"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-neutral-300 dark:text-neutral-600">/</span>
              )}
              <span
                className={
                  crumb.isLast
                    ? "font-medium text-neutral-900 dark:text-white"
                    : "text-neutral-500 dark:text-neutral-400"
                }
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {currentOrg && (
          <div className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm text-neutral-600 lg:flex dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
            <Building2 className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="max-w-[180px] truncate font-medium text-neutral-900 dark:text-white">
                {currentOrg.name}
              </p>
              <p className="text-xs capitalize text-neutral-500">
                {currentRole} workspace
              </p>
            </div>
          </div>
        )}

        <WorkspaceQuickActions />

        <NotificationsMenu />

        <UserMenu />
      </div>
    </header>
  );
}
