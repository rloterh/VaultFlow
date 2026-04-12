import type { QueueAccountabilitySummary } from "@/lib/operations/accountability";
import type { CollectionsQueueSummary } from "@/lib/collections/queue";
import type { PaymentRecoveryPreset } from "@/lib/invoices/payments";
import type { InvoiceStatus } from "@/types/database";
import type { ReportFilters, ReportSummary } from "@/lib/reports/analytics";
import { hasPermission, type Role } from "@/config/roles";
import {
  buildBillingRecoveryPresetHref,
  buildClientWorkspaceHref,
  buildReportPresetHref,
} from "@/lib/operations/launchpad";

type ClientSavedViewLike = {
  label: string;
  health: "all" | "new" | "healthy" | "attention" | "at-risk";
  queuePreset: "all" | "needs-touch" | "overdue" | "unreminded";
  touchFilter: "all" | "untouched" | "recent" | "stale";
};

type ReportSavedPresetLike = {
  label: string;
  range: ReportFilters["range"];
  status: ReportFilters["status"];
};

type BillingSavedPresetLike = {
  label: string;
  preset: PaymentRecoveryPreset;
};

export interface OperatorHandoffAction {
  title: string;
  detail: string;
  href: string;
  category: "clients" | "reports" | "billing";
}

export interface OperatorHandoff {
  title: string;
  detail: string;
  actions: OperatorHandoffAction[];
}

function findClientView(
  views: ClientSavedViewLike[],
  predicate: (view: ClientSavedViewLike) => boolean
) {
  return views.find(predicate) ?? null;
}

function findReportPreset(
  presets: ReportSavedPresetLike[],
  predicate: (preset: ReportSavedPresetLike) => boolean
) {
  return presets.find(predicate) ?? null;
}

function findBillingPreset(
  presets: BillingSavedPresetLike[],
  preset: PaymentRecoveryPreset
) {
  return presets.find((entry) => entry.preset === preset) ?? null;
}

function buildReportAction(preset: ReportSavedPresetLike | null) {
  if (preset) {
    return {
      title: preset.label,
      detail: "Saved report preset for finance and collections visibility.",
      href: buildReportPresetHref({
        range: preset.range,
        status: preset.status,
      }),
      category: "reports" as const,
    };
  }

  return {
    title: "Open reports",
    detail: "Use the default reporting workspace when no saved preset matches this condition.",
    href: buildReportPresetHref({
      range: "90d",
      status: "all",
    }),
    category: "reports" as const,
  };
}

function canOpenBillingWorkspace(role: Role | null) {
  return role ? hasPermission(role, "org:billing") : false;
}

function canOpenReportsWorkspace(role: Role | null) {
  return role ? hasPermission(role, "reports:read") : false;
}

function canOperateInvoices(role: Role | null) {
  return role ? hasPermission(role, "invoices:update") : false;
}

function isVendorRole(role: Role | null) {
  return role === "vendor";
}

function isReadOnlyPersona(role: Role | null) {
  return role === "viewer" || role === "member";
}

function buildOverdueAction({
  role,
  queue,
  reportSummary,
  savedBillingPresets,
}: {
  role: Role | null;
  queue: CollectionsQueueSummary;
  reportSummary: ReportSummary;
  savedBillingPresets: BillingSavedPresetLike[];
}): OperatorHandoffAction {
  const overdueCount = queue.overdue || reportSummary.overdueCount;

  if (canOpenBillingWorkspace(role)) {
    const billingPreset = findBillingPreset(savedBillingPresets, "overdue");

    return {
      title: billingPreset?.label ?? "Overdue recovery",
      detail: `${overdueCount} overdue item${overdueCount === 1 ? "" : "s"} need attention first.`,
      href: billingPreset
        ? buildBillingRecoveryPresetHref(billingPreset.preset)
        : buildBillingRecoveryPresetHref("overdue"),
      category: "billing",
    };
  }

  if (isVendorRole(role)) {
    return {
      title: "Assigned overdue accounts",
      detail:
        "Review the overdue portion of your assigned portfolio and escalate recovery actions to an internal finance operator.",
      href: buildClientWorkspaceHref({
        health: "attention",
        queuePreset: "overdue",
        touchFilter: "stale",
      }),
      category: "clients",
    };
  }

  if (canOpenReportsWorkspace(role)) {
    return {
      title: "Overdue oversight",
      detail:
        "Validate the overdue posture from a read-ready reporting lens before routing collection follow-up.",
      href: buildReportPresetHref({
        range: "90d",
        status: "overdue",
      }),
      category: "reports",
    };
  }

  return {
    title: "Overdue accounts",
    detail: "Start from the client workspace so the current collections pressure is visible in context.",
    href: buildClientWorkspaceHref({
      health: "attention",
      queuePreset: "overdue",
      touchFilter: "stale",
    }),
    category: "clients",
  };
}

function buildRoleAwareSummary({
  role,
  queue,
  accountability,
}: {
  role: Role | null;
  queue: CollectionsQueueSummary;
  accountability: QueueAccountabilitySummary;
}) {
  if (queue.overdue > 0) {
    if (role === "finance_manager") {
      return {
        title: "Cash collection should lead the day",
        detail:
          "Overdue balances are active, so finance should begin in recovery-oriented workspaces, confirm follow-up ownership, and keep Stripe-side continuity visible.",
      };
    }

    if (isVendorRole(role)) {
      return {
        title: "Assigned portfolio needs escalation-ready review",
        detail:
          "Your seat is scoped to assigned clients, so start by validating overdue accounts and surfacing anything that needs an internal billing operator to intervene.",
      };
    }

    if (isReadOnlyPersona(role)) {
      return {
        title: "Oversight is surfacing real collection risk",
        detail:
          "Use the read-only workspaces to verify overdue exposure and escalate the highest-risk items to finance managers, admins, or owners for action.",
      };
    }

    return {
      title: "Collections risk is the first priority",
      detail:
        "Overdue balances are live in the workspace, so finance and operators should move into recovery before taking on softer monitoring work.",
    };
  }

  if (queue.needsTouch > 0 || accountability.staleOwned > 0) {
    if (role === "finance_manager") {
      return {
        title: "Recovery coverage needs tighter follow-through",
        detail:
          "Open balances still need fresh touches or clearer ownership, so finance should start in collections-focused queues before moving back into broader reporting.",
      };
    }

    if (isVendorRole(role)) {
      return {
        title: "Assigned accounts need follow-up visibility",
        detail:
          "Review stale or untouched assigned accounts first so internal operators have cleaner context when follow-up or billing intervention is needed.",
      };
    }

    if (isReadOnlyPersona(role)) {
      return {
        title: "The workspace needs follow-up discipline",
        detail:
          "Untouched or stale items are visible from your oversight lane, so start by validating ownership gaps and routing the right teams into the focused workspaces below.",
      };
    }

    return {
      title: "The workspace needs follow-up discipline",
      detail:
        "Open balances still need touches or fresher ownership, so the handoff should start in collections-focused workspaces before moving into wider reporting.",
    };
  }

  if (role === "finance_manager") {
    return {
      title: "The workspace is clear for finance oversight",
      detail:
        "No urgent recovery pressure is dominating the queue, so you can work from reporting, subscription posture, and billing-monitoring views rather than immediate collections intervention.",
    };
  }

  if (isVendorRole(role)) {
    return {
      title: "Assigned portfolio is stable",
      detail:
        "No urgent issues are dominating your scoped accounts right now, so use the client workspaces to stay current and escalate only when the portfolio posture changes.",
    };
  }

  if (isReadOnlyPersona(role)) {
    return {
      title: "Oversight workspace is stable",
      detail:
        "No urgent queue pressure is dominating the day, so your role can monitor reporting, ownership, and activity signals instead of reacting to immediate recovery work.",
    };
  }

  return {
    title: "The workspace is stable enough for oversight",
    detail:
      "No urgent queue pressure is dominating the day, so the team can work from reporting and monitoring lenses rather than immediate recovery queues.",
  };
}

export function buildOperatorHandoff({
  role,
  queue,
  accountability,
  reportSummary,
  savedClientViews,
  savedReportPresets,
  savedBillingPresets,
}: {
  role: Role | null;
  queue: CollectionsQueueSummary;
  accountability: QueueAccountabilitySummary;
  reportSummary: ReportSummary;
  savedClientViews: ClientSavedViewLike[];
  savedReportPresets: ReportSavedPresetLike[];
  savedBillingPresets: BillingSavedPresetLike[];
}): OperatorHandoff {
  const actions: OperatorHandoffAction[] = [];

  if (queue.overdue > 0 || reportSummary.overdueCount > 0) {
    actions.push(
      buildOverdueAction({
        role,
        queue,
        reportSummary,
        savedBillingPresets,
      })
    );
  }

  if (queue.unreminded > 0 || accountability.untouchedOverdue > 0) {
    const clientView =
      findClientView(savedClientViews, (view) => view.queuePreset === "unreminded") ??
      findClientView(savedClientViews, (view) => view.touchFilter === "untouched");
    actions.push({
      title: clientView?.label ?? "Unreminded accounts",
      detail: isReadOnlyPersona(role)
        ? `${queue.unreminded} invoice${queue.unreminded === 1 ? "" : "s"} still have no reminder touchpoint logged. Use this view to validate exposure and escalate follow-up.`
        : isVendorRole(role)
          ? `${queue.unreminded} invoice${queue.unreminded === 1 ? "" : "s"} in your assigned scope still have no reminder touchpoint logged.`
          : `${queue.unreminded} invoice${queue.unreminded === 1 ? "" : "s"} still have no reminder touchpoint logged.`,
      href: clientView
        ? buildClientWorkspaceHref(clientView)
        : buildClientWorkspaceHref({
            health: "all",
            queuePreset: "unreminded",
            touchFilter: "untouched",
          }),
      category: "clients",
    });
  } else if (queue.needsTouch > 0 || accountability.staleOwned > 0) {
    const clientView =
      findClientView(savedClientViews, (view) => view.queuePreset === "needs-touch") ??
      findClientView(savedClientViews, (view) => view.touchFilter === "stale");
    actions.push({
      title: clientView?.label ?? "Collections focus",
      detail: isReadOnlyPersona(role)
        ? `${queue.needsTouch} invoice${queue.needsTouch === 1 ? "" : "s"} still need an operator touchpoint. Review the stale slice and route the right owner back in.`
        : isVendorRole(role)
          ? `${queue.needsTouch} assigned invoice${queue.needsTouch === 1 ? "" : "s"} still need a fresh touchpoint from the internal team.`
          : `${queue.needsTouch} invoice${queue.needsTouch === 1 ? "" : "s"} still need an operator touchpoint.`,
      href: clientView
        ? buildClientWorkspaceHref(clientView)
        : buildClientWorkspaceHref({
            health: "all",
            queuePreset: "needs-touch",
            touchFilter: "stale",
          }),
      category: "clients",
    });
  }

  if (
    canOpenReportsWorkspace(role) &&
    (reportSummary.outstandingBalance > 0 || reportSummary.totalInvoices > 0)
  ) {
    const reportPreset =
      findReportPreset(savedReportPresets, (preset) => preset.status === "all") ??
      findReportPreset(savedReportPresets, (preset) => preset.status === ("overdue" as InvoiceStatus));
    const reportAction = buildReportAction(reportPreset);
    actions.push({
      ...reportAction,
      detail: isReadOnlyPersona(role)
        ? "Review the reporting baseline and escalate any anomalies that need an operator or finance response."
        : reportAction.detail,
    });
  }

  if (actions.length === 0) {
    actions.push({
      title: canOperateInvoices(role) ? "Open invoice workspace" : "Open client workspace",
      detail: canOperateInvoices(role)
        ? "Use the invoice workspace to review the current operating posture and pick up the next action."
        : "Use the client workspace to review exposure, ownership, and recent activity from a safe operational surface.",
      href: canOperateInvoices(role) ? "/dashboard/invoices" : "/dashboard/clients",
      category: canOperateInvoices(role) ? "billing" : "clients",
    });
  }

  const deduped = actions.filter(
    (action, index) => actions.findIndex((entry) => entry.href === action.href) === index
  );
  const summary = buildRoleAwareSummary({
    role,
    queue,
    accountability,
  });

  return {
    title: summary.title,
    detail: summary.detail,
    actions: deduped.slice(0, 3),
  };
}
