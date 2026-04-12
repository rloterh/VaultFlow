export interface InvoiceHistoryEntryRecord {
  id: string;
  action: string;
  entity_id?: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  actor?: { full_name?: string | null; email?: string | null };
}

export interface InvoiceHistoryEvent {
  id: string;
  title: string;
  detail: string;
  tone: "default" | "success" | "warning" | "danger" | "info";
  createdAt: string;
  actorName: string;
}

export type InvoiceLaunchIntent = "recovery" | "record-payment" | "history";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function buildInvoiceIntentHref(
  invoiceId: string,
  intent: InvoiceLaunchIntent
) {
  return `/dashboard/invoices/${invoiceId}?intent=${intent}`;
}

export function filterInvoiceHistoryEntries(
  entries: InvoiceHistoryEntryRecord[],
  invoiceId: string,
  invoiceNumber: string
) {
  return entries.filter((entry) => {
    const metadata = entry.metadata as { invoice_id?: string; invoice_number?: string };

    return (
      entry.entity_id === invoiceId ||
      metadata.invoice_id === invoiceId ||
      metadata.invoice_number === invoiceNumber
    );
  });
}

export function buildInvoiceHistoryEvents(entries: InvoiceHistoryEntryRecord[]): InvoiceHistoryEvent[] {
  return entries.map((entry) => {
    const metadata = entry.metadata as {
      amount?: number;
      adjustment_note?: string;
      invoice_number?: string;
      resulting_balance?: number;
      resulting_credited_amount?: number;
      resulting_refunded_amount?: number;
      status?: string;
      refund_status?: string;
      stripe_refund_id?: string;
      stripe_credit_note_id?: string;
      stripe_invoice_number?: string;
    };
    const actorName = entry.actor?.full_name || entry.actor?.email || "System";

    switch (entry.action) {
      case "invoice.sent":
        return {
          id: entry.id,
          title: "Invoice sent",
          tone: "info",
          detail: "Invoice was moved live and is ready for customer collection.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.paid":
        return {
          id: entry.id,
          title: "Marked paid",
          tone: "success",
          detail: "Invoice was marked fully settled by an operator.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.overdue":
        return {
          id: entry.id,
          title: "Marked overdue",
          tone: "warning",
          detail: "Invoice was escalated into collections attention.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.cancelled":
        return {
          id: entry.id,
          title: "Invoice cancelled",
          tone: "danger",
          detail: "Collections work was intentionally stopped for this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.payment_recorded":
      case "payment_recorded":
        return {
          id: entry.id,
          title: "Manual payment recorded",
          tone: metadata.resulting_balance === 0 ? "success" : "info",
          detail: `${metadata.amount ? fmt(Number(metadata.amount)) : "A payment"} was reconciled manually.${typeof metadata.resulting_balance === "number" ? ` ${fmt(Number(metadata.resulting_balance))} remains open.` : ""}`,
          createdAt: entry.created_at,
          actorName,
        };
      case "payment_failed":
        return {
          id: entry.id,
          title: "Stripe payment failed",
          tone: "danger",
          detail: metadata.amount
            ? `${fmt(Number(metadata.amount))} failed in Stripe${metadata.stripe_invoice_number ? ` for ${metadata.stripe_invoice_number}` : ""}.`
            : "A Stripe payment failed and needs recovery handling.",
          createdAt: entry.created_at,
          actorName,
        };
      case "payment_received":
        return {
          id: entry.id,
          title: "Stripe payment received",
          tone: "success",
          detail: metadata.amount
            ? `${fmt(Number(metadata.amount))} settled successfully${metadata.stripe_invoice_number ? ` for ${metadata.stripe_invoice_number}` : ""}.`
            : "A Stripe payment settled successfully.",
          createdAt: entry.created_at,
          actorName,
        };
      case "payment_refund_requested":
        return {
          id: entry.id,
          title: "Stripe refund initiated",
          tone: "info",
          detail: metadata.amount
            ? `${fmt(Number(metadata.amount))} was submitted to Stripe for refund${typeof metadata.stripe_refund_id === "string" ? ` (${metadata.stripe_refund_id})` : ""}.${typeof metadata.resulting_balance === "number" ? ` Projected open balance: ${fmt(Number(metadata.resulting_balance))}.` : ""}${typeof metadata.adjustment_note === "string" && metadata.adjustment_note.trim().length > 0 ? ` Note: ${metadata.adjustment_note}` : ""}`
            : "A Stripe refund was initiated for this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.credit_requested":
        return {
          id: entry.id,
          title: "Stripe credit initiated",
          tone: "info",
          detail: metadata.amount
            ? `${fmt(Number(metadata.amount))} was submitted to Stripe as a credit note${typeof metadata.stripe_credit_note_id === "string" ? ` (${metadata.stripe_credit_note_id})` : ""}.${typeof metadata.resulting_balance === "number" ? ` Projected open balance: ${fmt(Number(metadata.resulting_balance))}.` : ""}${typeof metadata.adjustment_note === "string" && metadata.adjustment_note.trim().length > 0 ? ` Note: ${metadata.adjustment_note}` : ""}`
            : "A Stripe credit note was initiated for this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.void_requested":
        return {
          id: entry.id,
          title: "Stripe void initiated",
          tone: "info",
          detail:
            typeof metadata.adjustment_note === "string" &&
            metadata.adjustment_note.trim().length > 0
              ? `Stripe has been asked to void this invoice. Note: ${metadata.adjustment_note}`
              : "Stripe has been asked to void this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "payment_refunded":
        return {
          id: entry.id,
          title: "Payment refunded",
          tone: metadata.status === "pending" ? "info" : "warning",
          detail:
            metadata.status === "pending"
              ? metadata.amount
                ? `${fmt(Number(metadata.amount))} is still pending settlement in Stripe.`
                : "A Stripe refund is still pending settlement."
              : metadata.amount
                ? `${fmt(Number(metadata.amount))} was refunded back to the customer.${typeof metadata.resulting_balance === "number" ? ` ${fmt(Number(metadata.resulting_balance))} remains open.` : ""}${typeof metadata.adjustment_note === "string" && metadata.adjustment_note.trim().length > 0 ? ` Note: ${metadata.adjustment_note}` : ""}`
                : "A payment refund was recorded for this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.credited":
        return {
          id: entry.id,
          title: "Credit applied",
          tone: "info",
          detail: metadata.amount
            ? `${fmt(Number(metadata.amount))} was reserved as credit against this invoice.${typeof metadata.resulting_balance === "number" ? ` ${fmt(Number(metadata.resulting_balance))} remains open.` : ""}${typeof metadata.adjustment_note === "string" && metadata.adjustment_note.trim().length > 0 ? ` Note: ${metadata.adjustment_note}` : ""}`
            : "A credit adjustment was recorded for this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.voided":
        return {
          id: entry.id,
          title: "Invoice voided",
          tone: "danger",
          detail:
            typeof metadata.adjustment_note === "string" &&
            metadata.adjustment_note.trim().length > 0
              ? `This invoice was voided as part of a later-stage billing lifecycle adjustment. Note: ${metadata.adjustment_note}`
              : "This invoice was voided as part of a later-stage billing lifecycle adjustment.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.stripe_linked":
        return {
          id: entry.id,
          title: "Stripe identifiers linked",
          tone: "info",
          detail: "Stripe invoice or payment intent identifiers were stored so future webhook billing events can attach directly to this invoice.",
          createdAt: entry.created_at,
          actorName,
        };
      case "invoice.recovery_reviewed":
        return {
          id: entry.id,
          title: "Recovery review logged",
          tone: "warning",
          detail: "An operator reviewed the invoice for collections follow-up.",
          createdAt: entry.created_at,
          actorName,
        };
      default:
        return {
          id: entry.id,
          title: entry.action.replace(/[._]/g, " "),
          tone: "default",
          detail: "Invoice activity captured for audit and recovery continuity.",
          createdAt: entry.created_at,
          actorName,
        };
    }
  });
}
