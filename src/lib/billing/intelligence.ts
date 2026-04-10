import type { OrgPlan } from "@/types/auth";
import type { ActivityEntry, Invoice } from "@/types/database";
import { getPaymentPortfolioSummary } from "@/lib/invoices/payments";

type BillingTone = "default" | "success" | "warning" | "danger" | "info";

export interface BillingUsageMetric {
  count: number;
  limit: number;
  progress: number;
  tone: BillingTone;
  label: string;
  detail: string;
}

export interface BillingTimelineItem {
  id: string;
  title: string;
  description: string;
  tone: BillingTone;
  createdAt: string;
}

export interface BillingHealthCard {
  label: string;
  value: string;
  tone: BillingTone;
  detail: string;
}

export interface BillingInsight {
  tone: BillingTone;
  title: string;
  description: string;
}

export interface BillingWorkspaceSummary {
  invoiceUsage: BillingUsageMetric;
  seatUsage: BillingUsageMetric;
  healthCards: BillingHealthCard[];
  insights: BillingInsight[];
  timeline: BillingTimelineItem[];
  collectionMetrics: {
    label: string;
    value: string;
    detail: string;
    tone: BillingTone;
  }[];
}

function deriveUsageMetric(count: number, limit: number, noun: string): BillingUsageMetric {
  if (limit < 0) {
    return {
      count,
      limit,
      progress: 18,
      tone: "success",
      label: "Unlimited",
      detail: `${count} ${noun} active under the current tier.`,
    };
  }

  const progress = limit > 0 ? Math.min((count / limit) * 100, 100) : 0;
  const tone = progress >= 100 ? "danger" : progress >= 85 ? "warning" : progress >= 60 ? "info" : "success";

  const label =
    progress >= 100
      ? "Capacity exceeded"
      : progress >= 85
        ? "Nearing limit"
        : progress >= 60
          ? "Healthy but rising"
          : "Within plan";

  const remaining = Math.max(limit - count, 0);
  const detail =
    remaining === 0
      ? `No ${noun} remaining before the plan cap is reached.`
      : `${remaining} ${noun} remaining before the current cap.`;

  return {
    count,
    limit,
    progress,
    tone,
    label,
    detail,
  };
}

function getEventAmountLabel(metadata: Record<string, unknown>) {
  const amount = typeof metadata.amount === "number" ? metadata.amount : null;
  const currency = typeof metadata.currency === "string" ? metadata.currency.toUpperCase() : "USD";

  if (amount === null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function describeBillingEvent(entry: ActivityEntry): BillingTimelineItem {
  const metadata = entry.metadata ?? {};
  const amountLabel = getEventAmountLabel(metadata);

  switch (entry.action) {
    case "plan_upgraded":
      return {
        id: entry.id,
        title: "Plan upgraded",
        description: `Workspace moved onto the ${String(metadata.plan ?? "paid")} plan.`,
        tone: "success",
        createdAt: entry.created_at,
      };
    case "subscription_updated":
      return {
        id: entry.id,
        title: "Subscription updated",
        description: `Stripe reported a ${String(metadata.status ?? "managed")} subscription state on the ${String(metadata.plan ?? "current")} plan.`,
        tone: metadata.status === "active" ? "info" : "warning",
        createdAt: entry.created_at,
      };
    case "subscription_cancelled":
      return {
        id: entry.id,
        title: "Subscription cancelled",
        description: `Commercial access rolled back from ${String(metadata.previous_plan ?? "the previous")} plan.`,
        tone: "warning",
        createdAt: entry.created_at,
      };
    case "payment_received":
      return {
        id: entry.id,
        title: "Payment received",
        description: amountLabel ? `${amountLabel} settled successfully.` : "A Stripe invoice settled successfully.",
        tone: "success",
        createdAt: entry.created_at,
      };
    case "payment_failed":
      return {
        id: entry.id,
        title: "Payment failed",
        description: amountLabel ? `${amountLabel} needs recovery in Stripe.` : "A Stripe invoice payment needs recovery.",
        tone: "danger",
        createdAt: entry.created_at,
      };
    case "payment_refund_requested":
      return {
        id: entry.id,
        title: "Refund initiated",
        description: amountLabel
          ? `${amountLabel} was submitted to Stripe and is awaiting final settlement.`
          : "A Stripe refund has been initiated and is awaiting settlement.",
        tone: "info",
        createdAt: entry.created_at,
      };
    case "invoice.credit_requested":
      return {
        id: entry.id,
        title: "Credit note initiated",
        description: amountLabel
          ? `${amountLabel} was submitted to Stripe as a credit note.`
          : "A Stripe credit note has been initiated and is awaiting confirmation.",
        tone: "info",
        createdAt: entry.created_at,
      };
    case "payment_refunded":
      return {
        id: entry.id,
        title: "Payment refunded",
        description: amountLabel
          ? `${amountLabel} was returned and should be reconciled against the invoice ledger.`
          : "A refunded payment is waiting for invoice-side reconciliation.",
        tone: "warning",
        createdAt: entry.created_at,
      };
    case "invoice.credited":
      return {
        id: entry.id,
        title: "Credit applied",
        description: amountLabel
          ? `${amountLabel} was recorded as invoice credit.`
          : "A credit adjustment was recorded against an invoice.",
        tone: "info",
        createdAt: entry.created_at,
      };
    case "invoice.voided":
      return {
        id: entry.id,
        title: "Invoice voided",
        description: "An invoice was voided and should no longer remain in active recovery views.",
        tone: "danger",
        createdAt: entry.created_at,
      };
    case "invoice.void_requested":
      return {
        id: entry.id,
        title: "Void initiated",
        description:
          "Stripe has been asked to void an invoice and the workspace is awaiting confirmation.",
        tone: "info",
        createdAt: entry.created_at,
      };
    case "invoice.stripe_linked":
      return {
        id: entry.id,
        title: "Stripe linkage updated",
        description:
          "Finance stored Stripe invoice identifiers to make later billing events attach directly to this invoice.",
        tone: "info",
        createdAt: entry.created_at,
      };
    case "payment_recorded":
      return {
        id: entry.id,
        title: "Manual payment recorded",
        description: amountLabel
          ? `${amountLabel} was reconciled against ${String(metadata.invoice_number ?? "an invoice")}.`
          : `A manual payment was reconciled against ${String(metadata.invoice_number ?? "an invoice")}.`,
        tone: metadata.fully_paid ? "success" : "info",
        createdAt: entry.created_at,
      };
    default:
      return {
        id: entry.id,
        title: entry.action.replace(/_/g, " "),
        description: "Billing activity captured from Stripe and workspace operations.",
        tone: "default",
        createdAt: entry.created_at,
      };
  }
}

function derivePaymentCard(events: ActivityEntry[], hasSubscription: boolean): BillingHealthCard {
  if (!hasSubscription) {
    return {
      label: "Payment posture",
      value: "No payment method required",
      tone: "default",
      detail: "The workspace is still on the free tier until a paid plan is activated.",
    };
  }

  const lastSuccess = events.find((event) => event.action === "payment_received");
  const lastFailure = events.find((event) => event.action === "payment_failed");

  if (lastFailure && (!lastSuccess || new Date(lastFailure.created_at) > new Date(lastSuccess.created_at))) {
    return {
      label: "Payment posture",
      value: "Recovery needed",
      tone: "danger",
      detail: "The latest Stripe invoice failed. Route operators to the customer portal and monitor retries.",
    };
  }

  if (lastSuccess) {
    return {
      label: "Payment posture",
      value: "Healthy collection",
      tone: "success",
      detail: "Recent Stripe billing activity shows a successful payment on file.",
    };
  }

  return {
    label: "Payment posture",
    value: "Awaiting billing history",
    tone: "info",
    detail: "The subscription is active, but this workspace has not recorded a recent payment event yet.",
  };
}

function deriveRenewalCard(
  plan: OrgPlan,
  invoiceUsage: BillingUsageMetric,
  seatUsage: BillingUsageMetric,
  hasSubscription: boolean
): BillingHealthCard {
  if (!hasSubscription) {
    return {
      label: "Renewal readiness",
      value: "Self-serve",
      tone: "default",
      detail: "Upgrade when you want paid capacity, branded workflows, and Stripe-managed billing.",
    };
  }

  const hasPressure =
    invoiceUsage.tone === "warning" ||
    invoiceUsage.tone === "danger" ||
    seatUsage.tone === "warning" ||
    seatUsage.tone === "danger";

  if (hasPressure && plan !== "enterprise") {
    return {
      label: "Renewal readiness",
      value: "Expansion recommended",
      tone: "warning",
      detail: "Commercial usage is pressing against plan limits before the next billing cycle resets.",
    };
  }

  return {
    label: "Renewal readiness",
    value: "On track",
    tone: "success",
    detail: "Capacity and billing activity are stable for the current commercial tier.",
  };
}

function deriveCapacityCard(
  invoiceUsage: BillingUsageMetric,
  seatUsage: BillingUsageMetric,
  plan: OrgPlan
): BillingHealthCard {
  const stressed = [invoiceUsage.tone, seatUsage.tone].includes("danger");
  const warming = [invoiceUsage.tone, seatUsage.tone].includes("warning");

  if (stressed) {
    return {
      label: "Capacity risk",
      value: "Immediate action",
      tone: "danger",
      detail: `At least one workspace control has already exceeded the ${plan} plan allowance.`,
    };
  }

  if (warming) {
    return {
      label: "Capacity risk",
      value: "Monitor closely",
      tone: "warning",
      detail: "Usage is approaching plan thresholds and may create billing or access friction soon.",
    };
  }

  return {
    label: "Capacity risk",
    value: "Contained",
    tone: "success",
    detail: "Invoice volume and team size are well within the current plan envelope.",
  };
}

function deriveSubscriptionCard(plan: OrgPlan, hasSubscription: boolean, events: ActivityEntry[]): BillingHealthCard {
  if (!hasSubscription) {
    return {
      label: "Subscription health",
      value: "Free tier",
      tone: "default",
      detail: "Billing is running self-serve until a paid workspace subscription is activated.",
    };
  }

  const lastUpdate = events.find(
    (event) => event.action === "subscription_updated" || event.action === "plan_upgraded"
  );

  const status = typeof lastUpdate?.metadata?.status === "string" ? lastUpdate.metadata.status : "active";

  return {
    label: "Subscription health",
    value: status === "active" ? "Managed" : status.replace(/_/g, " "),
    tone: status === "active" ? "success" : "warning",
    detail: `Stripe subscription management is active for the ${plan} plan workspace.`,
  };
}

function deriveInsights(
  plan: OrgPlan,
  invoiceUsage: BillingUsageMetric,
  seatUsage: BillingUsageMetric,
  invoices: Pick<Invoice, "status" | "total">[],
  events: ActivityEntry[]
): BillingInsight[] {
  const insights: BillingInsight[] = [];
  const overdueExposure = invoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);

  if (invoiceUsage.tone === "danger" || seatUsage.tone === "danger") {
    insights.push({
      tone: "danger",
      title: "Current plan is blocking growth",
      description: "Usage is already over plan capacity. Upgrade or reduce load to avoid operator friction.",
    });
  } else if ((invoiceUsage.tone === "warning" || seatUsage.tone === "warning") && plan !== "enterprise") {
    insights.push({
      tone: "warning",
      title: "Commercial expansion window",
      description: "This workspace is close to its paid capacity limits. Plan an upgrade before the next billing cycle.",
    });
  }

  const lastFailure = events.find((event) => event.action === "payment_failed");
  const lastSuccess = events.find((event) => event.action === "payment_received");
  if (lastFailure && (!lastSuccess || new Date(lastFailure.created_at) > new Date(lastSuccess.created_at))) {
    insights.push({
      tone: "danger",
      title: "Billing recovery needed",
      description: "The most recent Stripe invoice failed. Direct finance owners to the portal and monitor the next retry.",
    });
  }

  if (overdueExposure > 0) {
    insights.push({
      tone: "info",
      title: "Revenue operations exposure",
      description: `${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      }).format(overdueExposure)} is currently overdue across live invoices.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: "success",
      title: "Billing posture is stable",
      description: "Plan capacity, recent payment behavior, and receivables signals are all within a healthy range.",
    });
  }

  return insights.slice(0, 3);
}

export function buildBillingWorkspaceSummary({
  plan,
  hasSubscription,
  invoiceCount,
  memberCount,
  invoiceLimit,
  memberLimit,
  invoices,
  events,
}: {
  plan: OrgPlan;
  hasSubscription: boolean;
  invoiceCount: number;
  memberCount: number;
  invoiceLimit: number;
  memberLimit: number;
  invoices: Pick<Invoice, "status" | "total" | "amount_paid">[];
  events: ActivityEntry[];
}): BillingWorkspaceSummary {
  const invoiceUsage = deriveUsageMetric(invoiceCount, invoiceLimit, "invoices");
  const seatUsage = deriveUsageMetric(memberCount, memberLimit, "seats");
  const collections = getPaymentPortfolioSummary(invoices);

  return {
    invoiceUsage,
    seatUsage,
    healthCards: [
      deriveSubscriptionCard(plan, hasSubscription, events),
      derivePaymentCard(events, hasSubscription),
      deriveRenewalCard(plan, invoiceUsage, seatUsage, hasSubscription),
      deriveCapacityCard(invoiceUsage, seatUsage, plan),
    ],
    insights: deriveInsights(plan, invoiceUsage, seatUsage, invoices, events),
    timeline: events.map(describeBillingEvent),
    collectionMetrics: [
      {
        label: "Collected cash",
        value: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
        }).format(collections.collectedAmount),
        detail: `${collections.fullyCollectedCount} invoices are fully settled.`,
        tone: "success",
      },
      {
        label: "Residual balance",
        value: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
        }).format(collections.outstandingAmount),
        detail: `${collections.openCount + collections.partiallyCollectedCount} invoices still carry open balance.`,
        tone: collections.overdueOpenCount > 0 ? "warning" : "info",
      },
      {
        label: "Partial collections",
        value: String(collections.partiallyCollectedCount),
        detail: "Invoices with cash received but balance still outstanding.",
        tone: collections.partiallyCollectedCount > 0 ? "info" : "default",
      },
      {
        label: "Overdue open invoices",
        value: String(collections.overdueOpenCount),
        detail: "Collections items still past due with residual exposure.",
        tone: collections.overdueOpenCount > 0 ? "danger" : "success",
      },
    ],
  };
}
