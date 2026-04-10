"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/hooks/use-auth";
import { useOrgStore } from "@/stores/org-store";
import { mainNavItems, bottomNavItems, type NavItem } from "@/config/navigation";
import { hasMinRole } from "@/config/roles";
import { Avatar } from "@/components/ui/badge";

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
          : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-white",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.title : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && (
        <span className="truncate">{item.title}</span>
      )}
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { profile } = useAuth();
  const { currentOrg, currentRole } = useOrgStore();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUIStore((s) => s.toggleSidebarCollapse);

  function filterByRole(items: NavItem[]): NavItem[] {
    return items.filter((item) => {
      if (!item.minRole) return true;
      if (!currentRole) return false;
      return hasMinRole(currentRole, item.minRole);
    });
  }

  const visibleMainItems = filterByRole(mainNavItems);
  const visibleBottomItems = filterByRole(
    bottomNavItems.flatMap((item) => (item.children ? filterByRole(item.children) : [item]))
  );

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-neutral-200 bg-white transition-all duration-300 dark:border-neutral-800 dark:bg-neutral-950",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 dark:bg-white">
              <span className="text-xs font-bold text-white dark:text-neutral-900">V</span>
            </div>
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              VaultFlow
            </span>
          </Link>
        )}
        <button
          onClick={toggleCollapse}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Org switcher */}
      {!collapsed && currentOrg && (
        <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
          <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                  {currentOrg.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                    {currentOrg.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs capitalize text-neutral-500">
                    <span>{currentRole}</span>
                    <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <span>{currentOrg.plan} plan</span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
              </button>
            </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {visibleMainItems.map((item) => (
          <NavItemLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="space-y-1 border-t border-neutral-200 px-3 py-3 dark:border-neutral-800">
        {visibleBottomItems.map((item) => (
          <NavItemLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </div>

      {/* User profile */}
      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}
        >
          <Avatar
            name={profile?.full_name}
            src={profile?.avatar_url}
            size="sm"
          />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                  {profile?.full_name || "User"}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {profile?.email}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
