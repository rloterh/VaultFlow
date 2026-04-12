import type { InvoiceStatus } from "@/types/database";
import type { ReportRange, ReportSummary } from "@/lib/reports/analytics";

type BriefingTone = "info" | "success" | "warning" | "danger";

export interface ReportWorkspaceBriefing {
  tone: BriefingTone;
  title: string;
  detail: string;
  recommendations: string[];
  stats: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
}

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function getRangeLabel(range: ReportRange) {
  return {
    "30d": "last 30 days",
    "90d": "last 90 days",
    "365d": "last 12 months",
    all: "full history",
  }[range];
}

function getStatusLabel(status: InvoiceStatus | "all") {
  return status === "all" ? "all statuses" : status;
}

export function buildReportWorkspaceBriefing({
  label,
  range,
  status,
  summary,
}: {
  label: string;
  range: ReportRange;
  status: InvoiceStatus | "all";
  summary: ReportSummary;
}): ReportWorkspaceBriefing {
  const stats = [
    {
      label: "Invoices in scope",
      value: String(summary.totalInvoices),
      detail: `Reporting over ${getRangeLabel(range)} for ${getStatusLabel(status)}.`,
    },
    {
      label: "Collected revenue",
      value: fmt(summary.collectedRevenue),
      detail: `Collection rate is ${summary.collectionRate}% in the current slice.`,
    },
    {
      label: "Outstanding pressure",
      value: fmt(summary.outstandingBalance),
      detail:
        summary.overdueCount > 0
          ? `${summary.overdueCount} overdue invoice${summary.overdueCount === 1 ? "" : "s"} are still unresolved.`
          : "No overdue invoices are contributing to the open balance.",
    },
  ];

  const recommendations: string[] = [];

  if (summary.overdueCount > 0) {
    recommendations.push(
      `Move from this report into the attention queue and recovery views first. ${summary.overdueCount} overdue invoice${summary.overdueCount === 1 ? "" : "s"} are still aging.`
    );
  }

  if (summary.outstandingBalance > 0 && summary.collectionRate < 70) {
    recommendations.push(
      "Collection efficiency is soft in this slice. Review reminder cadence and open matching invoices for operator follow-up."
    );
  }

  if (summary.totalInvoices === 0) {
    recommendations.push(
      "This preset is currently empty. Broaden the range or switch status when you need a more representative reporting slice."
    );
  }

  if (recommendations.length === 0 && summary.outstandingBalance > 0) {
    recommendations.push(
      "This report is stable enough for monitoring. Use it as a checkpoint between collections sweeps instead of an urgent recovery queue."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "This view is healthy. Keep it as a recurring oversight preset and export it when stakeholders need a lightweight snapshot."
    );
  }

  if (summary.overdueCount > 0) {
    return {
      tone: "danger",
      title: `${label} is carrying collections risk`,
      detail:
        "The current report slice includes overdue balances, so the next best action is recovery routing rather than passive monitoring.",
      recommendations,
      stats,
    };
  }

  if (summary.outstandingBalance > 0) {
    return {
      tone: "warning",
      title: `${label} still has open receivables in motion`,
      detail:
        "Balances are still working through the pipeline, but they have not slipped fully into overdue recovery yet.",
      recommendations,
      stats,
    };
  }

  return {
    tone: summary.totalInvoices > 0 ? "success" : "info",
    title:
      summary.totalInvoices > 0
        ? `${label} is operationally clean`
        : `${label} is waiting on activity`,
    detail:
      summary.totalInvoices > 0
        ? "This slice is useful for oversight and export because it is not carrying active collections stress."
        : "This preset has no invoice activity in view right now, so treat it as a standby lens until billing volume returns.",
    recommendations,
    stats,
  };
}
