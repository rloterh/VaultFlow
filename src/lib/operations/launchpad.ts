import {
  buildClientOpsViewHref,
  type ClientHealthFilter,
} from "@/lib/operations/client-views";
import type { CollectionsQueuePreset } from "@/lib/collections/queue";
import type { PaymentRecoveryPreset } from "@/lib/invoices/payments";
import type { ReportFilters } from "@/lib/reports/analytics";

export function buildClientWorkspaceHref({
  health,
  queuePreset,
  touchFilter,
}: {
  health: ClientHealthFilter;
  queuePreset: CollectionsQueuePreset;
  touchFilter: "all" | "untouched" | "recent" | "stale";
}) {
  const viewId =
    health === "all" && queuePreset === "all"
      ? "all-accounts"
      : queuePreset === "overdue"
        ? "at-risk-accounts"
        : queuePreset === "unreminded"
          ? "unreminded-open"
          : "collections-focus";
  const baseHref = buildClientOpsViewHref(viewId, {
    health,
    queuePreset,
  });

  return touchFilter === "all" ? baseHref : `${baseHref}&touch=${touchFilter}`;
}

export function buildReportPresetHref(filters: ReportFilters) {
  const params = new URLSearchParams({
    range: filters.range,
    status: filters.status,
  });

  return `/dashboard/reports?${params.toString()}`;
}

export function buildBillingRecoveryPresetHref(preset: PaymentRecoveryPreset) {
  const params = new URLSearchParams({
    recovery: preset,
  });

  return `/settings/billing?${params.toString()}`;
}
