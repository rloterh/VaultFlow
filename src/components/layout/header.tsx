"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, index + 1).join("/"),
    isLast: index === segments.length - 1,
  }));
}

export function Header() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/80 px-6 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden dark:hover:bg-neutral-800"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && (
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
        {/* Search */}
        <Button variant="ghost" size="sm" className="gap-2 text-neutral-500">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 sm:inline dark:border-neutral-700">
            ⌘K
          </kbd>
        </Button>

        {/* Notifications */}
        <button className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
        </button>
      </div>
    </header>
  );
}
