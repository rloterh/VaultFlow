import { hasPermission, type Role } from "@/config/roles";
import type {
  ClientCollectionsSummary,
  ClientFinancialSnapshot,
} from "@/lib/clients/insights";
import {
  buildBillingRecoveryPresetHref,
  buildClientWorkspaceHref,
  buildReportPresetHref,
} from "@/lib/operations/launchpad";

type SignalTone = "default" | "success" | "warning" | "danger" | "info";
type SignalKind = "overdue" | "stale-touch" | "concentration" | "stable";

export interface ClientAccountSignal {
  id: string;
  clientId: string;
  clientName: string;
  company: string | null;
  healthLabel: string;
  tone: SignalTone;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  routeLabel: string;
  routeHref: string;
  handoffDetail: string;
}

export interface ClientAccountSignalsSnapshot {
  tone: SignalTone;
  title: string;
  detail: string;
  signals: ClientAccountSignal[];
}

type ClientAccountSignalInput = {
  id: string;
  name: string;
  company: string | null;
  total_revenue: number | string | null;
  snapshot: Pick<
    ClientFinancialSnapshot,
    "health" | "healthLabel" | "pendingTotal" | "overdueTotal" | "openInvoices"
  >;
  collections: Pick<
    ClientCollectionsSummary,
    | "openInvoices"
    | "needsTouch"
    | "overdue"
    | "unreminded"
    | "latestReminderAt"
    | "totalOutstanding"
  >;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.max(value, 0));
}

function daysSince(value: string | null) {
  if (!value) {
    return null;
  }

  const delta = Date.now() - new Date(value).getTime();
  return Math.max(Math.round(delta / (1000 * 60 * 60 * 24)), 0);
}

function isReadOnlyRole(role: Role | null | undefined) {
  return role === "viewer" || role === "member";
}

function getPrimaryAction(role: Role | null | undefined) {
  if (role === "vendor") {
    return "Open assigned account";
  }

  if (role && (hasPermission(role, "clients:update") || hasPermission(role, "invoices:update"))) {
    return "Open account";
  }

  return "Review account";
}

function getRouteAction(role: Role | null | undefined, kind: SignalKind) {
  if (kind === "stable") {
    if (role && hasPermission(role, "reports:read")) {
      return {
        label: "Open reports",
        href: buildReportPresetHref({ range: "90d", status: "all" }),
      };
    }

    return {
      label: "Open client workspace",
      href: buildClientWorkspaceHref({
        health: "all",
        queuePreset: "all",
        touchFilter: "all",
      }),
    };
  }

  if (kind === "overdue") {
    if (role && hasPermission(role, "org:billing")) {
      return {
        label: "Open billing recovery",
        href: buildBillingRecoveryPresetHref("overdue"),
      };
    }

    if (role && hasPermission(role, "invoices:update")) {
      return {
        label: "Open matching invoices",
        href: "/dashboard/invoices?queue=overdue",
      };
    }

    if (role && hasPermission(role, "reports:read")) {
      return {
        label: "Open overdue reports",
        href: buildReportPresetHref({ range: "90d", status: "overdue" }),
      };
    }

    return {
      label: "Open client workspace",
      href: buildClientWorkspaceHref({
        health: "attention",
        queuePreset: "overdue",
        touchFilter: "stale",
      }),
    };
  }

  if (kind === "stale-touch") {
    if (role && hasPermission(role, "org:billing")) {
      return {
        label: "Open finance priority queue",
        href: buildBillingRecoveryPresetHref("priority"),
      };
    }

    if (role && hasPermission(role, "invoices:update")) {
      return {
        label: "Open collections queue",
        href: "/dashboard/invoices?queue=needs-touch",
      };
    }

    if (role === "vendor") {
      return {
        label: "Open assigned workspace",
        href: buildClientWorkspaceHref({
          health: "attention",
          queuePreset: "needs-touch",
          touchFilter: "stale",
        }),
      };
    }

    if (role && hasPermission(role, "reports:read")) {
      return {
        label: "Open exposure reports",
        href: buildReportPresetHref({ range: "90d", status: "all" }),
      };
    }

    return {
      label: "Open client workspace",
      href: buildClientWorkspaceHref({
        health: "attention",
        queuePreset: "needs-touch",
        touchFilter: "stale",
      }),
    };
  }

  if (role && hasPermission(role, "reports:read")) {
    return {
      label: "Open concentration reports",
      href: buildReportPresetHref({ range: "90d", status: "all" }),
    };
  }

  if (role && hasPermission(role, "org:billing")) {
    return {
      label: "Open billing workspace",
      href: buildBillingRecoveryPresetHref("open"),
    };
  }

  return {
    label: "Open client workspace",
    href: buildClientWorkspaceHref({
      health: "all",
      queuePreset: "all",
      touchFilter: "all",
    }),
  };
}

function getHandoffDetail(
  role: Role | null | undefined,
  kind: SignalKind,
  clientName: string
) {
  if (kind === "stable") {
    if (isReadOnlyRole(role)) {
      return `Use ${clientName} as a healthy reference point while you monitor the rest of the workspace for drift.`;
    }

    if (role === "vendor") {
      return `Keep ${clientName} as a stable anchor inside your assigned portfolio and escalate only if receivables posture changes.`;
    }

    return `No immediate escalation is required for ${clientName}; keep it in periodic review while higher-pressure accounts are handled first.`;
  }

  if (kind === "overdue") {
    if (role && hasPermission(role, "org:billing")) {
      return `Finance should confirm recovery ownership for ${clientName} and keep the Stripe-side payment path visible until the overdue balance moves.`;
    }

    if (role === "vendor") {
      return `Review the assigned account context for ${clientName}, then escalate the overdue position to an internal finance-capable operator.`;
    }

    if (isReadOnlyRole(role)) {
      return `Validate the overdue posture on ${clientName} and route the account to finance managers, admins, or owners for action.`;
    }

    return `Reopen invoice follow-through for ${clientName} and confirm the next owner before the overdue balance ages further.`;
  }

  if (kind === "stale-touch") {
    if (role && hasPermission(role, "org:billing")) {
      return `Finance should refresh outreach on ${clientName} and verify that recovery notes stay current across the billing lifecycle.`;
    }

    if (role === "vendor") {
      return `Use the assigned account detail to restore context on ${clientName}, then flag the stale touchpoint for internal follow-up.`;
    }

    if (isReadOnlyRole(role)) {
      return `Surface the stale outreach posture on ${clientName} so a finance or operations owner can pick up the next touchpoint.`;
    }

    return `Record the next outreach step for ${clientName} so collections coverage stays explicit instead of implicit.`;
  }

  if (role && hasPermission(role, "reports:read")) {
    return `Keep ${clientName} visible in reports while you confirm whether the broader workspace needs rebalancing or executive attention.`;
  }

  if (role === "vendor") {
    return `Monitor how much of your assigned exposure sits with ${clientName} and flag any imbalance before it becomes a delivery risk.`;
  }

  return `Use ${clientName} as the anchor account when rechecking exposure concentration and next-owner continuity across the workspace.`;
}

function buildSummary(
  role: Role | null | undefined,
  signals: ClientAccountSignal[],
  scopeLabel: string
): Pick<ClientAccountSignalsSnapshot, "tone" | "title" | "detail"> {
  if (signals.length === 0) {
    return {
      tone: "success",
      title: "Enterprise account signals are steady",
      detail:
        role === "vendor"
          ? `Your assigned portfolio is not surfacing concentrated client risk right now, so this ${scopeLabel} can stay in monitor mode.`
          : isReadOnlyRole(role)
            ? `This ${scopeLabel} is not showing major handoff gaps, so oversight can stay broad rather than reactive.`
            : `The current ${scopeLabel} is not surfacing major enterprise-account pressure, so operators can stay disciplined without immediate escalation.`,
    };
  }

  const dangerCount = signals.filter((signal) => signal.tone === "danger").length;

  if (dangerCount > 0) {
    return {
      tone: "danger",
      title: "Enterprise account signals need guided intervention",
      detail:
        role && hasPermission(role, "org:billing")
          ? `High-risk accounts are surfacing in this ${scopeLabel}. Keep the next finance owner, recovery route, and account context explicit as you work through them.`
          : `High-risk accounts are surfacing in this ${scopeLabel}. Use the account detail and route links to keep escalation targeted instead of broad.`,
    };
  }

  return {
    tone: "warning",
    title: "Enterprise account signals need follow-through",
    detail:
      role === "vendor"
        ? `A few assigned accounts need tighter coordination, but the portfolio still looks recoverable with clear internal handoff.`
        : isReadOnlyRole(role)
          ? `A few accounts need tighter attention, so the best move is to validate posture and route the right operators into action.`
          : `A few accounts are drifting into softer risk. Keep the next action and handoff path visible before that pressure compounds.`,
  };
}

export function buildClientAccountSignalsSnapshot({
  accounts,
  role,
  scopeLabel = "client workspace",
}: {
  accounts: ClientAccountSignalInput[];
  role: Role | null | undefined;
  scopeLabel?: string;
}): ClientAccountSignalsSnapshot {
  if (accounts.length === 0) {
    return {
      tone: "info",
      title: "Enterprise account signals will appear once accounts are in scope",
      detail:
        "This workspace slice does not currently contain active accounts, so there is nothing to score for handoff pressure yet.",
      signals: [],
    };
  }

  const routeFor = (kind: SignalKind) => getRouteAction(role, kind);
  const openExposureTotal = accounts.reduce(
    (sum, account) => sum + account.collections.totalOutstanding,
    0
  );
  const selectedClientIds = new Set<string>();
  const signals: ClientAccountSignal[] = [];

  const overdueAccount = [...accounts]
    .filter((account) => account.snapshot.overdueTotal > 0)
    .sort(
      (left, right) =>
        right.snapshot.overdueTotal - left.snapshot.overdueTotal ||
        right.collections.needsTouch - left.collections.needsTouch
    )[0];

  if (overdueAccount) {
    selectedClientIds.add(overdueAccount.id);
    const route = routeFor("overdue");
    signals.push({
      id: "overdue-account",
      clientId: overdueAccount.id,
      clientName: overdueAccount.name,
      company: overdueAccount.company,
      healthLabel: overdueAccount.snapshot.healthLabel,
      tone:
        overdueAccount.snapshot.overdueTotal >= 25000 ||
        overdueAccount.collections.overdue >= 3
          ? "danger"
          : "warning",
      title: "Largest overdue account",
      detail: `${overdueAccount.name} is carrying ${formatCurrency(
        overdueAccount.snapshot.overdueTotal
      )} overdue across ${overdueAccount.collections.overdue} invoice${
        overdueAccount.collections.overdue === 1 ? "" : "s"
      }.`,
      actionLabel: getPrimaryAction(role),
      actionHref: `/dashboard/clients/${overdueAccount.id}`,
      routeLabel: route.label,
      routeHref: route.href,
      handoffDetail: getHandoffDetail(role, "overdue", overdueAccount.name),
    });
  }

  const staleTouchAccount = [...accounts]
    .filter((account) => {
      if (selectedClientIds.has(account.id) || account.collections.openInvoices === 0) {
        return false;
      }

      const age = daysSince(account.collections.latestReminderAt);
      return account.collections.latestReminderAt === null || (age !== null && age > 7);
    })
    .sort((left, right) => {
      const leftAge = daysSince(left.collections.latestReminderAt) ?? 999;
      const rightAge = daysSince(right.collections.latestReminderAt) ?? 999;

      return (
        right.collections.totalOutstanding - left.collections.totalOutstanding ||
        rightAge - leftAge
      );
    })[0];

  if (staleTouchAccount) {
    selectedClientIds.add(staleTouchAccount.id);
    const route = routeFor("stale-touch");
    const touchAge = daysSince(staleTouchAccount.collections.latestReminderAt);
    const touchDetail =
      staleTouchAccount.collections.latestReminderAt === null
        ? `No reminder activity has been logged for ${staleTouchAccount.collections.openInvoices} open invoice${
            staleTouchAccount.collections.openInvoices === 1 ? "" : "s"
          }.`
        : `The last reminder landed ${touchAge} day${touchAge === 1 ? "" : "s"} ago across an open balance of ${formatCurrency(
            staleTouchAccount.collections.totalOutstanding
          )}.`;

    signals.push({
      id: "stale-touch-account",
      clientId: staleTouchAccount.id,
      clientName: staleTouchAccount.name,
      company: staleTouchAccount.company,
      healthLabel: staleTouchAccount.snapshot.healthLabel,
      tone:
        staleTouchAccount.collections.latestReminderAt === null &&
        staleTouchAccount.collections.totalOutstanding >= 10000
          ? "danger"
          : "warning",
      title:
        staleTouchAccount.collections.latestReminderAt === null
          ? "Reminder coverage has not started"
          : "Touchpoint coverage is aging",
      detail: `${staleTouchAccount.name} needs a fresher operator touchpoint. ${touchDetail}`,
      actionLabel: getPrimaryAction(role),
      actionHref: `/dashboard/clients/${staleTouchAccount.id}`,
      routeLabel: route.label,
      routeHref: route.href,
      handoffDetail: getHandoffDetail(role, "stale-touch", staleTouchAccount.name),
    });
  }

  const concentratedAccount = [...accounts]
    .filter((account) => !selectedClientIds.has(account.id) && account.collections.totalOutstanding > 0)
    .map((account) => ({
      account,
      share:
        openExposureTotal > 0
          ? account.collections.totalOutstanding / openExposureTotal
          : 0,
      revenue: Number(account.total_revenue ?? 0),
    }))
    .sort(
      (left, right) =>
        right.share - left.share ||
        right.account.collections.totalOutstanding - left.account.collections.totalOutstanding ||
        right.revenue - left.revenue
    )[0];

  if (concentratedAccount && concentratedAccount.share >= 0.35) {
    const route = routeFor("concentration");
    signals.push({
      id: "concentration-account",
      clientId: concentratedAccount.account.id,
      clientName: concentratedAccount.account.name,
      company: concentratedAccount.account.company,
      healthLabel: concentratedAccount.account.snapshot.healthLabel,
      tone: concentratedAccount.share >= 0.5 ? "danger" : "info",
      title: "Exposure is concentrated in one account",
      detail: `${concentratedAccount.account.name} represents ${Math.round(
        concentratedAccount.share * 100
      )}% of open exposure in the current ${scopeLabel}.`,
      actionLabel: getPrimaryAction(role),
      actionHref: `/dashboard/clients/${concentratedAccount.account.id}`,
      routeLabel: route.label,
      routeHref: route.href,
      handoffDetail: getHandoffDetail(
        role,
        "concentration",
        concentratedAccount.account.name
      ),
    });
  }

  if (signals.length === 0) {
    const healthiestAccount = [...accounts].sort(
      (left, right) =>
        Number(right.total_revenue ?? 0) - Number(left.total_revenue ?? 0) ||
        right.snapshot.pendingTotal - left.snapshot.pendingTotal
    )[0];

    if (healthiestAccount) {
      const route = routeFor("stable");
      signals.push({
        id: "stable-account",
        clientId: healthiestAccount.id,
        clientName: healthiestAccount.name,
        company: healthiestAccount.company,
        healthLabel: healthiestAccount.snapshot.healthLabel,
        tone: "success",
        title: "Top account is operating within plan",
        detail: `${healthiestAccount.name} is not surfacing overdue pressure or stale touchpoint drift right now.`,
        actionLabel: getPrimaryAction(role),
        actionHref: `/dashboard/clients/${healthiestAccount.id}`,
        routeLabel: route.label,
        routeHref: route.href,
        handoffDetail: getHandoffDetail(role, "stable", healthiestAccount.name),
      });
    }
  }

  return {
    ...buildSummary(role, signals, scopeLabel),
    signals: signals.slice(0, 3),
  };
}
