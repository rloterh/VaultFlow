import type { PaymentRecoveryPreset } from "@/lib/invoices/payments";
import type { ReportFilters } from "@/lib/reports/analytics";

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
