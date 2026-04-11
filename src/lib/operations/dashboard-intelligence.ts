import type { ActivityEntry, Client, Invoice } from "@/types/database";

type IntelligenceTone = "default" | "success" | "warning" | "danger" | "info";

export interface ForecastMetric {
  label: string;
  value: string;
  tone: IntelligenceTone;
  detail: string;
}

export interface IntelligenceAlert {
  id: string;
  title: string;
  detail: string;
  tone: IntelligenceTone;
  href: string;
  actionLabel: string;
}

export interface DashboardIntelligenceSnapshot {
  forecastMetrics: ForecastMetric[];
  alerts: IntelligenceAlert[];
}

type IntelligenceInvoice = Pick<
  Invoice,
  | "client_id"
  | "status"
  | "total"
  | "amount_paid"
  | "due_date"
  | "paid_at"
  | "voided_at"
  | "last_recovery_reviewed_at"
> & {
  client?: { name?: string | null } | null;
};

type IntelligenceClient = Pick<Client, "id" | "name">;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.max(value, 0));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(left: Date, right: Date) {
  return Math.round(
    (startOfDay(left).getTime() - startOfDay(right).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getInvoiceTotal(invoice: Pick<IntelligenceInvoice, "total">) {
  return Number(invoice.total ?? 0);
}

function getOutstandingAmount(
  invoice: Pick<IntelligenceInvoice, "total" | "amount_paid">
) {
  return Math.max(getInvoiceTotal(invoice) - Number(invoice.amount_paid ?? 0), 0);
}

function getRecentPaidAmounts(invoices: IntelligenceInvoice[], referenceDate: Date) {
  const windows = [
    { label: "current", from: 0, to: 29 },
    { label: "previous", from: 30, to: 59 },
    { label: "baseline", from: 60, to: 89 },
  ];

  return windows.map((window) => {
    const amount = invoices
      .filter((invoice) => {
        if (!invoice.paid_at) return false;
        const daysAgo = daysBetween(referenceDate, new Date(invoice.paid_at));
        return daysAgo >= window.from && daysAgo <= window.to;
      })
      .reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? invoice.total ?? 0), 0);

    return { label: window.label, amount };
  });
}

export function buildDashboardIntelligenceSnapshot({
  invoices,
  clients,
  activity,
  referenceDate = new Date(),
  scopeLabel = "workspace",
}: {
  invoices: IntelligenceInvoice[];
  clients: IntelligenceClient[];
  activity: ActivityEntry[];
  referenceDate?: Date;
  scopeLabel?: string;
}): DashboardIntelligenceSnapshot {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const paidAmounts = getRecentPaidAmounts(invoices, referenceDate);
  const currentPaid = paidAmounts.find((entry) => entry.label === "current")?.amount ?? 0;
  const previousPaid = paidAmounts.find((entry) => entry.label === "previous")?.amount ?? 0;
  const baselinePaid =
    paidAmounts.reduce((sum, entry) => sum + entry.amount, 0) / Math.max(paidAmounts.length, 1);

  const nextThirtyForecast = Math.round((currentPaid + previousPaid + baselinePaid) / 3);
  const openInvoices = invoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled" && !invoice.voided_at
  );
  const overdueInvoices = openInvoices.filter((invoice) => invoice.status === "overdue");
  const dueSoonInvoices = openInvoices.filter((invoice) => {
    const daysUntilDue = daysBetween(new Date(invoice.due_date), referenceDate);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });
  const staleRecoveryInvoices = overdueInvoices.filter((invoice) => {
    if (!invoice.last_recovery_reviewed_at) {
      return true;
    }

    return daysBetween(referenceDate, new Date(invoice.last_recovery_reviewed_at)) > 7;
  });

  const overdueExposure = overdueInvoices.reduce(
    (sum, invoice) => sum + getOutstandingAmount(invoice),
    0
  );
  const dueSoonExposure = dueSoonInvoices.reduce(
    (sum, invoice) => sum + getOutstandingAmount(invoice),
    0
  );
  const overdueByClient = overdueInvoices.reduce<Map<string, number>>((map, invoice) => {
    map.set(invoice.client_id, (map.get(invoice.client_id) ?? 0) + getOutstandingAmount(invoice));
    return map;
  }, new Map());
  const largestOverdueClient = Array.from(overdueByClient.entries())
    .map(([clientId, amount]) => ({
      clientId,
      amount,
      name: clientsById.get(clientId)?.name ?? "Unknown client",
    }))
    .sort((left, right) => right.amount - left.amount)[0];
  const concentrationRatio =
    overdueExposure > 0 && largestOverdueClient ? largestOverdueClient.amount / overdueExposure : 0;

  const recentPaymentFailures = activity.filter((entry) => {
    if (entry.action !== "payment_failed") return false;
    return daysBetween(referenceDate, new Date(entry.created_at)) <= 14;
  });

  const forecastMetrics: ForecastMetric[] = [
    {
      label: "30-day cash forecast",
      value: formatCurrency(nextThirtyForecast),
      tone:
        nextThirtyForecast === 0
          ? "default"
          : previousPaid > 0 && currentPaid < previousPaid * 0.75
            ? "warning"
            : "success",
      detail:
        currentPaid > 0
          ? `Projected from the last 90 days of collection activity across the current ${scopeLabel}.`
          : `Waiting on more paid history before the forecast becomes highly reliable for this ${scopeLabel}.`,
    },
    {
      label: "Due-soon exposure",
      value: formatCurrency(dueSoonExposure),
      tone: dueSoonExposure > overdueExposure && dueSoonExposure > 0 ? "warning" : "info",
      detail: `${dueSoonInvoices.length} open invoice${dueSoonInvoices.length === 1 ? "" : "s"} are due within 7 days.`,
    },
    {
      label: "Recovery freshness",
      value: staleRecoveryInvoices.length === 0 ? "Current" : `${staleRecoveryInvoices.length} stale`,
      tone:
        staleRecoveryInvoices.length === 0
          ? "success"
          : staleRecoveryInvoices.length >= 3
            ? "danger"
            : "warning",
      detail:
        staleRecoveryInvoices.length === 0
          ? "Overdue invoices in view have recent recovery review coverage."
          : "Some overdue invoices have not been reviewed recently enough for reliable collections follow-through.",
    },
  ];

  const alerts: IntelligenceAlert[] = [];

  if (recentPaymentFailures.length > 0) {
    alerts.push({
      id: "payment-failures",
      title: "Recent payment failures are clustering",
      detail: `${recentPaymentFailures.length} payment failure event${recentPaymentFailures.length === 1 ? "" : "s"} landed in the last 14 days and may need recovery follow-through.`,
      tone: recentPaymentFailures.length >= 3 ? "danger" : "warning",
      href: "/settings/billing",
      actionLabel: "Open billing recovery",
    });
  }

  if (concentrationRatio >= 0.4 && largestOverdueClient) {
    alerts.push({
      id: "overdue-concentration",
      title: "Overdue exposure is concentrated",
      detail: `${largestOverdueClient.name} represents ${Math.round(concentrationRatio * 100)}% of overdue balance in the current ${scopeLabel}.`,
      tone: concentrationRatio >= 0.6 ? "danger" : "warning",
      href: `/dashboard/clients/${largestOverdueClient.clientId}`,
      actionLabel: "Open client",
    });
  }

  if (staleRecoveryInvoices.length > 0) {
    alerts.push({
      id: "stale-recovery",
      title: "Recovery review coverage is lagging",
      detail: `${staleRecoveryInvoices.length} overdue invoice${staleRecoveryInvoices.length === 1 ? "" : "s"} are missing recent recovery review signals.`,
      tone: staleRecoveryInvoices.length >= 3 ? "danger" : "warning",
      href: "/dashboard/invoices",
      actionLabel: "Open invoice workspace",
    });
  }

  if (currentPaid > 0 && previousPaid > 0 && currentPaid < previousPaid * 0.75) {
    alerts.push({
      id: "collection-slowdown",
      title: "Collections pace is softening",
      detail: `Collected cash in the most recent 30-day window is ${Math.round(
        ((previousPaid - currentPaid) / previousPaid) * 100
      )}% lower than the prior period.`,
      tone: "warning",
      href: "/dashboard/reports?range=90d&status=all",
      actionLabel: "Open reports",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable-posture",
      title: "No major anomalies detected",
      detail: `Collection pace, overdue concentration, and recovery freshness are within a healthy range for the current ${scopeLabel}.`,
      tone: "success",
      href: "/dashboard/reports?range=90d&status=all",
      actionLabel: "Open reports",
    });
  }

  return {
    forecastMetrics,
    alerts: alerts.slice(0, 3),
  };
}
