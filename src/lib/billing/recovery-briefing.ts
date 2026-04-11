import type {
  PaymentRecoveryPreset,
  PaymentRecoveryQueueItem,
} from "@/lib/invoices/payments";

type BriefingTone = "info" | "success" | "warning" | "danger";

export interface BillingRecoveryBriefing {
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

function getPresetLabel(preset: PaymentRecoveryPreset) {
  return {
    priority: "Priority recovery",
    overdue: "Overdue recovery",
    partial: "Partial collections",
    open: "Open balances",
  }[preset];
}

export function buildBillingRecoveryBriefing({
  label,
  preset,
  items,
}: {
  label: string;
  preset: PaymentRecoveryPreset;
  items: PaymentRecoveryQueueItem[];
}): BillingRecoveryBriefing {
  const outstandingAmount = items.reduce(
    (sum, item) => sum + item.outstandingAmount,
    0
  );
  const partialCount = items.filter((item) => item.isPartial).length;
  const overdueCount = items.filter((item) => item.status === "overdue").length;
  const topExposure = items[0]?.outstandingAmount ?? 0;

  const stats = [
    {
      label: "Invoices in queue",
      value: String(items.length),
      detail: `${getPresetLabel(preset)} currently includes ${items.length} invoice${items.length === 1 ? "" : "s"}.`,
    },
    {
      label: "Outstanding balance",
      value: fmt(outstandingAmount),
      detail:
        items.length > 0
          ? `${fmt(topExposure)} is the largest single balance in this slice.`
          : "No active recovery exposure is visible right now.",
    },
    {
      label: "Recovery mix",
      value: `${overdueCount}/${partialCount}`,
      detail: "Shown as overdue invoices versus partial collections in this queue.",
    },
  ];

  if (items.length === 0) {
    return {
      tone: "success",
      title: `${label} is clear`,
      detail:
        "No invoices currently match this recovery preset, so the queue is stable for this billing posture.",
      recommendations: [
        "Use another preset if you want a broader receivables check before closing out the session.",
        "If Stripe recently changed state, refresh after the next webhook sync to confirm nothing re-entered recovery.",
      ],
      stats,
    };
  }

  const recommendations: string[] = [];

  if (overdueCount > 0) {
    recommendations.push(
      `Start with the ${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"} before handling softer open balances.`
    );
  }

  if (partialCount > 0) {
    recommendations.push(
      `Review ${partialCount} partial collection${partialCount === 1 ? "" : "s"} for reconciliation or credit-note follow-up.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "This queue is mostly open balances without strong recovery signals yet. Monitor closely and route to reconciliation if payments start landing."
    );
  }

  if (overdueCount > 0) {
    return {
      tone: "danger",
      title: `${label} is carrying overdue recovery work`,
      detail:
        "The current billing slice contains overdue invoices, so finance should prioritize collection and Stripe follow-through over passive monitoring.",
      recommendations,
      stats,
    };
  }

  if (partialCount > 0) {
    return {
      tone: "warning",
      title: `${label} needs reconciliation attention`,
      detail:
        "Invoices in this preset already have cash movement, but balances still remain open and need operator review.",
      recommendations,
      stats,
    };
  }

  return {
    tone: "info",
    title: `${label} is an open-balance monitoring queue`,
    detail:
      "This slice is useful for proactive finance review before invoices slide into overdue recovery.",
    recommendations,
    stats,
  };
}
