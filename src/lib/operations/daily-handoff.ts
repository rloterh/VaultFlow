import type { QueueAccountabilitySummary } from "@/lib/operations/accountability";
import type { CollectionsQueueSummary } from "@/lib/collections/queue";
import type { PaymentRecoveryPreset } from "@/lib/invoices/payments";
import type { InvoiceStatus } from "@/types/database";
import type { ReportFilters, ReportSummary } from "@/lib/reports/analytics";
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

export function buildOperatorHandoff({
  queue,
  accountability,
  reportSummary,
  savedClientViews,
  savedReportPresets,
  savedBillingPresets,
}: {
  queue: CollectionsQueueSummary;
  accountability: QueueAccountabilitySummary;
  reportSummary: ReportSummary;
  savedClientViews: ClientSavedViewLike[];
  savedReportPresets: ReportSavedPresetLike[];
  savedBillingPresets: BillingSavedPresetLike[];
}): OperatorHandoff {
  const actions: OperatorHandoffAction[] = [];

  if (queue.overdue > 0 || reportSummary.overdueCount > 0) {
    const billingPreset = findBillingPreset(savedBillingPresets, "overdue");
    actions.push({
      title: billingPreset?.label ?? "Overdue recovery",
      detail: `${queue.overdue || reportSummary.overdueCount} overdue item${queue.overdue + reportSummary.overdueCount === 1 ? "" : "s"} need attention first.`,
      href: billingPreset
        ? buildBillingRecoveryPresetHref(billingPreset.preset)
        : buildBillingRecoveryPresetHref("overdue"),
      category: "billing",
    });
  }

  if (queue.unreminded > 0 || accountability.untouchedOverdue > 0) {
    const clientView =
      findClientView(savedClientViews, (view) => view.queuePreset === "unreminded") ??
      findClientView(savedClientViews, (view) => view.touchFilter === "untouched");
    actions.push({
      title: clientView?.label ?? "Unreminded accounts",
      detail: `${queue.unreminded} invoice${queue.unreminded === 1 ? "" : "s"} still have no reminder touchpoint logged.`,
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
      detail: `${queue.needsTouch} invoice${queue.needsTouch === 1 ? "" : "s"} still need an operator touchpoint.`,
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

  if (reportSummary.outstandingBalance > 0 || reportSummary.totalInvoices > 0) {
    const reportPreset =
      findReportPreset(savedReportPresets, (preset) => preset.status === "all") ??
      findReportPreset(savedReportPresets, (preset) => preset.status === ("overdue" as InvoiceStatus));
    actions.push(buildReportAction(reportPreset));
  }

  const deduped = actions.filter(
    (action, index) => actions.findIndex((entry) => entry.href === action.href) === index
  );

  if (queue.overdue > 0) {
    return {
      title: "Collections risk is the first priority",
      detail:
        "Overdue balances are live in the workspace, so finance and operators should move into recovery before taking on softer monitoring work.",
      actions: deduped.slice(0, 3),
    };
  }

  if (queue.needsTouch > 0 || accountability.staleOwned > 0) {
    return {
      title: "The workspace needs follow-up discipline",
      detail:
        "Open balances still need touches or fresher ownership, so the handoff should start in collections-focused workspaces before moving into wider reporting.",
      actions: deduped.slice(0, 3),
    };
  }

  return {
    title: "The workspace is stable enough for oversight",
    detail:
      "No urgent queue pressure is dominating the day, so the team can work from reporting and monitoring lenses rather than immediate recovery queues.",
    actions: deduped.slice(0, 3),
  };
}
