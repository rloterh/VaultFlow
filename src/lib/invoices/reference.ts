import type { Invoice } from "@/types/database";

type InvoiceIdentifierInput = Pick<
  Invoice,
  "id" | "org_id" | "invoice_number" | "stripe_invoice_id" | "stripe_payment_intent_id"
>;

export function buildInvoiceBillingReference(
  orgId: string,
  invoiceId: string,
  invoiceNumber: string
) {
  return `${orgId}:${invoiceId}:${invoiceNumber}`;
}

export function buildInvoiceIdentifiers(invoice: InvoiceIdentifierInput) {
  return {
    org_id: invoice.org_id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    billing_reference: buildInvoiceBillingReference(
      invoice.org_id,
      invoice.id,
      invoice.invoice_number
    ),
    stripe_invoice_id: invoice.stripe_invoice_id ?? null,
    stripe_payment_intent_id: invoice.stripe_payment_intent_id ?? null,
  };
}
