"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Bookmark,
  CreditCard,
  FileText,
  LayoutDashboard,
  Search,
  Settings2,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ROLE_METADATA, type Role } from "@/config/roles";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useStripePortal } from "@/hooks/use-stripe";
import {
  buildClientOpsViewHref,
  findMatchingClientOpsView,
} from "@/lib/operations/client-views";
import {
  buildBillingRecoveryPresetHref,
  buildReportPresetHref,
} from "@/lib/operations/launchpad";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils/cn";

type CommandItem = {
  id: string;
  title: string;
  description: string;
  section: string;
  icon: LucideIcon;
  keywords: string[];
  visible: boolean;
  run: () => void | Promise<void>;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function getPalettePlaceholder(role: Role | null) {
  if (role === "finance_manager") {
    return "Search billing recovery, reports, and finance workflows...";
  }

  if (role === "vendor") {
    return "Search assigned clients, invoices, and scoped workflows...";
  }

  if (role === "viewer" || role === "member") {
    return "Search oversight views, reports, and monitoring surfaces...";
  }

  return "Search navigation, workflows, and admin actions...";
}

function getEmptyStateCopy(role: Role | null) {
  if (role === "finance_manager") {
    return "Try searching for billing, recovery, reports, overdue, or portal.";
  }

  if (role === "vendor") {
    return "Try searching for assigned clients, invoices, overdue, or collections.";
  }

  if (role === "viewer" || role === "member") {
    return "Try searching for reports, invoices, clients, activity, or oversight.";
  }

  return "Try searching for invoices, billing, reports, team, or collections.";
}

function getFooterHint(role: Role | null, pathname: string) {
  if (pathname === "/dashboard") {
    if (role === "finance_manager") {
      return "You are on the finance dashboard.";
    }

    if (role === "vendor") {
      return "You are on the assigned vendor dashboard.";
    }

    if (role === "viewer" || role === "member") {
      return "You are on the oversight dashboard.";
    }

    return "You are on the main dashboard.";
  }

  if (role === "finance_manager") {
    return `Finance route: ${pathname}`;
  }

  if (role === "vendor") {
    return `Assigned-scope route: ${pathname}`;
  }

  if (role === "viewer" || role === "member") {
    return `Read-only route: ${pathname}`;
  }

  return `Current route: ${pathname}`;
}

export function WorkspaceQuickActions() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOrg } = useAuth();
  const { can, hasRole, role } = usePermissions();
  const setCollectionsPreset = useUIStore((s) => s.setCollectionsPreset);
  const setClientOpsView = useUIStore((s) => s.setClientOpsView);
  const savedClientWorkspaceViews = useUIStore((s) => s.savedClientWorkspaceViews);
  const savedReportPresets = useUIStore((s) => s.savedReportPresets);
  const savedBillingRecoveryPresets = useUIStore((s) => s.savedBillingRecoveryPresets);
  const { openPortal, isLoading: portalLoading } = useStripePortal();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [runningId, setRunningId] = useState<string | null>(null);

  const workspaceSavedViews = useMemo(
    () =>
      savedClientWorkspaceViews
        .filter((view) => view.orgId === currentOrg?.id)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 4),
    [currentOrg?.id, savedClientWorkspaceViews]
  );

  const workspaceSavedReportPresets = useMemo(
    () =>
      savedReportPresets
        .filter((preset) => preset.orgId === currentOrg?.id)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 4),
    [currentOrg?.id, savedReportPresets]
  );

  const workspaceSavedBillingPresets = useMemo(
    () =>
      savedBillingRecoveryPresets
        .filter((preset) => preset.orgId === currentOrg?.id)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 4),
    [currentOrg?.id, savedBillingRecoveryPresets]
  );

  const commands = useMemo<CommandItem[]>(() => {
    const navigation: CommandItem[] = [
      {
        id: "nav-dashboard",
        title: "Dashboard",
        description: "Open the revenue and workflow overview.",
        section: "Navigate",
        icon: LayoutDashboard,
        keywords: ["home", "overview", "revenue", "kpi"],
        visible: true,
        run: () => router.push("/dashboard"),
      },
      {
        id: "nav-invoices",
        title: "Invoices",
        description:
          role === "viewer" || role === "member"
            ? "Review invoice posture from a read-only oversight lane."
            : role === "vendor"
              ? "Review invoice context scoped to your assigned portfolio."
              : "Review invoice operations and lifecycle activity.",
        section: "Navigate",
        icon: FileText,
        keywords: ["billing", "invoice", "collections", "receivables"],
        visible: true,
        run: () => router.push("/dashboard/invoices"),
      },
      {
        id: "nav-clients",
        title: "Clients",
        description:
          role === "vendor"
            ? "Open account relationships and exposure views for your assigned scope."
            : "Open account relationships and exposure views.",
        section: "Navigate",
        icon: Users,
        keywords: ["accounts", "customers", "relationships"],
        visible: true,
        run: () => router.push("/dashboard/clients"),
      },
      {
        id: "nav-reports",
        title: "Reports",
        description:
          role === "viewer" || role === "member"
            ? "Inspect analytics and trends from a read-only reporting surface."
            : "Inspect analytics, trends, and reporting posture.",
        section: "Navigate",
        icon: BarChart3,
        keywords: ["analytics", "trends", "export", "finance"],
        visible: can("reports:read"),
        run: () => router.push("/dashboard/reports"),
      },
      {
        id: "nav-activity",
        title: "Activity Log",
        description: "Review workflow, billing, and governance events.",
        section: "Navigate",
        icon: Activity,
        keywords: ["audit", "history", "events", "timeline"],
        visible: hasRole("manager"),
        run: () => router.push("/dashboard/activity"),
      },
      {
        id: "nav-admin",
        title: "Admin Panel",
        description: "Open governance posture and moderation queue surfaces.",
        section: "Navigate",
        icon: Shield,
        keywords: ["admin", "governance", "moderation", "privileged"],
        visible: hasRole("admin"),
        run: () => router.push("/dashboard/admin"),
      },
      {
        id: "nav-settings",
        title: "Settings",
        description: "Manage your account and workspace preferences.",
        section: "Navigate",
        icon: Settings2,
        keywords: ["preferences", "organization", "profile"],
        visible: true,
        run: () => router.push("/settings"),
      },
      {
        id: "nav-team",
        title: "Team Access",
        description: "Review invites, roles, and vendor assignments.",
        section: "Navigate",
        icon: Users,
        keywords: ["members", "invite", "roles", "vendor"],
        visible: hasRole("admin"),
        run: () => router.push("/settings/team"),
      },
      {
        id: "nav-billing",
        title: "Billing Settings",
        description:
          role === "finance_manager"
            ? "Manage Stripe posture, payment recovery, and finance controls."
            : "Manage Stripe posture, plans, and recovery.",
        section: "Navigate",
        icon: CreditCard,
        keywords: ["stripe", "subscription", "payments", "portal"],
        visible: can("org:billing"),
        run: () => router.push("/settings/billing"),
      },
    ];

    const workflows: CommandItem[] = [
      {
        id: "workflow-collections",
        title: "Collections Focus",
        description:
          role === "vendor"
            ? "Jump into assigned accounts currently needing follow-up from the internal team."
            : role === "viewer" || role === "member"
              ? "Open a focused oversight view of accounts currently needing follow-up."
              : "Jump into open accounts currently needing follow-up.",
        section: "Workflows",
        icon: ArrowRight,
        keywords: ["collections", "needs touch", "follow-up", "queue"],
        visible: true,
        run: () => {
          setCollectionsPreset("needs-touch");
          setClientOpsView("collections-focus");
          router.push(buildClientOpsViewHref("collections-focus"));
        },
      },
      {
        id: "workflow-risk",
        title: "At-Risk Accounts",
        description:
          role === "vendor"
            ? "Open overdue accounts in your assigned scope and escalate billing action when needed."
            : role === "viewer" || role === "member"
              ? "Review overdue accounts from an oversight lane before routing action."
              : "Open overdue accounts requiring the fastest attention.",
        section: "Workflows",
        icon: ArrowRight,
        keywords: ["risk", "overdue", "accounts", "collections"],
        visible: true,
        run: () => {
          setCollectionsPreset("overdue");
          setClientOpsView("at-risk-accounts");
          router.push(buildClientOpsViewHref("at-risk-accounts"));
        },
      },
      {
        id: "workflow-unreminded",
        title: "Unreminded Open Invoices",
        description:
          role === "viewer" || role === "member"
            ? "Surface balances without a logged reminder yet so you can flag them for operators."
            : "Surface balances without a logged reminder yet.",
        section: "Workflows",
        icon: ArrowRight,
        keywords: ["unreminded", "open", "reminder", "invoices"],
        visible: true,
        run: () => {
          setCollectionsPreset("unreminded");
          setClientOpsView("unreminded-open");
          router.push(buildClientOpsViewHref("unreminded-open"));
        },
      },
      {
        id: "workflow-billing-portal",
        title: "Open Stripe Billing Portal",
        description:
          role === "finance_manager"
            ? "Jump directly into Stripe billing administration and recovery-safe actions."
            : "Jump directly into Stripe billing administration.",
        section: "Actions",
        icon: CreditCard,
        keywords: ["portal", "stripe", "billing", "payment method"],
        visible: can("org:billing") && !!currentOrg,
        run: async () => {
          if (currentOrg) {
            await openPortal(currentOrg.id);
          }
        },
      },
    ];

    const roleAwareShortcuts: CommandItem[] =
      role === "vendor"
        ? [
            {
              id: "workflow-vendor-clients",
              title: "Assigned Client Workspace",
              description: "Open the client workspace scoped to your assigned vendor accounts.",
              section: "Workflows",
              icon: Users,
              keywords: ["assigned", "vendor", "clients", "scope"],
              visible: true,
              run: () => router.push("/dashboard/clients"),
            },
          ]
        : role === "viewer" || role === "member"
          ? [
              {
                id: "workflow-oversight-invoices",
                title: "Invoice Oversight",
                description: "Open invoice posture for read-only monitoring and escalation.",
                section: "Workflows",
                icon: FileText,
                keywords: ["oversight", "invoice", "monitoring", "read only"],
                visible: true,
                run: () => router.push("/dashboard/invoices"),
              },
            ]
          : [];

    const savedViews: CommandItem[] = workspaceSavedViews.map((view) => ({
      id: `saved-view-${view.id}`,
      title: view.label,
      description: `Open ${view.health === "all" ? "all-health" : view.health} accounts in the ${view.queuePreset} queue with ${view.touchFilter === "all" ? "all touchpoints" : `${view.touchFilter} touchpoint`} coverage.`,
      section: "Saved views",
      icon: Bookmark,
      keywords: [
        "saved",
        "view",
        "client",
        "collections",
        view.label,
        view.health,
        view.queuePreset,
        view.touchFilter,
      ],
      visible: true,
      run: () => {
        const matchedView = findMatchingClientOpsView(view.health, view.queuePreset);
        const params = new URLSearchParams({
          health: view.health,
          queue: view.queuePreset,
        });

        if (view.touchFilter !== "all") {
          params.set("touch", view.touchFilter);
        }

        if (matchedView) {
          params.set("view", matchedView.id);
          setClientOpsView(matchedView.id);
        }

        setCollectionsPreset(view.queuePreset);
        router.push(`/dashboard/clients?${params.toString()}`);
      },
    }));

    const savedReportCommands: CommandItem[] = workspaceSavedReportPresets.map((preset) => ({
      id: `saved-report-${preset.id}`,
      title: preset.label,
      description: `Open the ${preset.range} reporting view with ${preset.status === "all" ? "all invoice statuses" : preset.status} already applied.`,
      section: "Saved reports",
      icon: BarChart3,
      keywords: [
        "saved",
        "report",
        "reporting",
        "analytics",
        preset.label,
        preset.range,
        preset.status,
      ],
      visible: can("reports:read"),
      run: () => {
        router.push(
          buildReportPresetHref({
            range: preset.range,
            status: preset.status,
          })
        );
      },
    }));

    const savedBillingCommands: CommandItem[] = workspaceSavedBillingPresets.map((preset) => ({
      id: `saved-billing-${preset.id}`,
      title: preset.label,
      description: `Open the ${preset.preset} recovery queue from your saved billing handoff presets.`,
      section: "Saved billing",
      icon: CreditCard,
      keywords: [
        "saved",
        "billing",
        "recovery",
        "stripe",
        "queue",
        preset.label,
        preset.preset,
      ],
      visible: can("org:billing"),
      run: () => {
        router.push(buildBillingRecoveryPresetHref(preset.preset));
      },
    }));

    return [
      ...navigation,
      ...workflows,
      ...roleAwareShortcuts,
      ...savedViews,
      ...savedReportCommands,
      ...savedBillingCommands,
    ].filter((item) => item.visible);
  }, [
    can,
    currentOrg,
    hasRole,
    openPortal,
    role,
    router,
    setClientOpsView,
    setCollectionsPreset,
    workspaceSavedBillingPresets,
    workspaceSavedReportPresets,
    workspaceSavedViews,
  ]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return commands;
    }

    return commands.filter((command) => {
      const haystack = [
        command.title,
        command.description,
        command.section,
        ...command.keywords,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const command of filteredCommands) {
      const current = groups.get(command.section) ?? [];
      current.push(command);
      groups.set(command.section, current);
    }
    return Array.from(groups.entries());
  }, [filteredCommands]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (!open) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (filteredCommands.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % filteredCommands.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          current === 0 ? filteredCommands.length - 1 : current - 1
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        void runCommand(filteredCommands[activeIndex]);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, filteredCommands, open]);

  async function runCommand(command: CommandItem) {
    setRunningId(command.id);
    try {
      await command.run();
      setOpen(false);
      setQuery("");
    } finally {
      setRunningId(null);
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-2 text-sm text-neutral-500 transition-colors hover:border-neutral-200 hover:bg-white hover:text-neutral-700 dark:hover:border-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 sm:inline dark:border-neutral-700">
          Ctrl K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-neutral-950/45 backdrop-blur-sm"
              aria-label="Close command palette"
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed left-1/2 top-[10vh] z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-neutral-400" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={getPalettePlaceholder(role)}
                    className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
                  />
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {role ? ROLE_METADATA[role].title : "Guest"}
                  </Badge>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-3">
                {groupedCommands.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-800">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      No matching command
                    </p>
                    <p className="mt-2 text-sm text-neutral-500">
                      {getEmptyStateCopy(role)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedCommands.map(([section, sectionItems]) => (
                      <div key={section}>
                        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          {section}
                        </p>
                        <div className="space-y-1">
                          {sectionItems.map((command) => {
                            const absoluteIndex = filteredCommands.findIndex(
                              (item) => item.id === command.id
                            );
                            const Icon = command.icon;
                            const isActive = absoluteIndex === activeIndex;

                            return (
                              <button
                                key={command.id}
                                type="button"
                                onMouseEnter={() => setActiveIndex(absoluteIndex)}
                                onClick={() => void runCommand(command)}
                                className={cn(
                                  "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                                  isActive
                                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white"
                                    : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900/70"
                                )}
                              >
                                <span
                                  className={cn(
                                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                    isActive
                                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400"
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium">
                                    {command.title}
                                  </span>
                                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                                    {command.description}
                                  </span>
                                </span>
                                {runningId === command.id ||
                                (command.id === "workflow-billing-portal" && portalLoading) ? (
                                  <span className="text-xs text-neutral-400">Opening...</span>
                                ) : (
                                  <span className="text-xs text-neutral-400">Enter</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400 dark:border-neutral-800">
                <span>Use arrow keys to move, Enter to open, Esc to close.</span>
                <span className="hidden sm:inline">{getFooterHint(role, pathname)}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
