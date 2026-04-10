import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) return stripeClient;

  stripeClient = new Stripe(getStripeSecretKey(), {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
  });

  return stripeClient;
}

export interface StripeInvoiceReferencePayload {
  orgId: string;
  invoiceId: string;
  invoiceNumber: string;
}

function buildStripeInvoiceMetadata(reference: StripeInvoiceReferencePayload) {
  return {
    org_id: reference.orgId,
    invoice_id: reference.invoiceId,
    invoice_number: reference.invoiceNumber,
    billing_reference: `${reference.orgId}:${reference.invoiceId}:${reference.invoiceNumber}`,
  };
}

function getInvoicePaymentIntentId(
  invoice: Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
  }
) {
  if (!invoice.payment_intent) {
    return null;
  }

  return typeof invoice.payment_intent === "string"
    ? invoice.payment_intent
    : invoice.payment_intent.id;
}

export interface StripeInvoiceLineItem {
  description: string;
  unitAmount: number;
  quantity?: number;
}

// ============================================
// PRICE IDS — set these in Stripe Dashboard
// ============================================

export const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
} as const;

// ============================================
// HELPERS
// ============================================

/**
 * Get or create a Stripe customer for an organization
 */
export async function getOrCreateCustomer(
  orgId: string,
  orgName: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  const stripe = getStripeClient();

  if (existingCustomerId) {
    try {
      await stripe.customers.retrieve(existingCustomerId);
      return existingCustomerId;
    } catch {
      // Customer was deleted — create a new one
    }
  }

  const customer = await stripe.customers.create({
    name: orgName,
    email,
    metadata: { org_id: orgId },
  });

  return customer.id;
}

/**
 * Create a checkout session for subscribing to a plan
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  orgId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { org_id: orgId },
    subscription_data: {
      metadata: { org_id: orgId },
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

/**
 * Create a billing portal session for managing subscription
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function syncStripeInvoiceReferences(
  reference: StripeInvoiceReferencePayload & {
    stripeInvoiceId?: string | null;
    stripePaymentIntentId?: string | null;
  }
) {
  const stripe = getStripeClient();
  const metadata = buildStripeInvoiceMetadata(reference);
  const tasks: Promise<unknown>[] = [];

  if (reference.stripeInvoiceId) {
    tasks.push(
      stripe.invoices.update(reference.stripeInvoiceId, {
        metadata,
      })
    );
  }

  if (reference.stripePaymentIntentId) {
    tasks.push(
      stripe.paymentIntents.update(reference.stripePaymentIntentId, {
        metadata,
      })
    );
  }

  await Promise.all(tasks);

  return {
    syncedInvoice: !!reference.stripeInvoiceId,
    syncedPaymentIntent: !!reference.stripePaymentIntentId,
  };
}

export async function createStripeRefund(params: {
  paymentIntentId: string;
  amount: number;
  metadata: Record<string, string>;
}) {
  const stripe = getStripeClient();

  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: Math.round(params.amount * 100),
    metadata: params.metadata,
  });
}

export async function getOrCreateInvoiceCustomer(params: {
  orgId: string;
  clientId: string;
  clientName: string;
  email: string;
  existingCustomerId?: string | null;
}) {
  const stripe = getStripeClient();

  if (params.existingCustomerId) {
    try {
      await stripe.customers.retrieve(params.existingCustomerId);
      return params.existingCustomerId;
    } catch {
      // Recreate if the prior linkage is no longer valid.
    }
  }

  const customer = await stripe.customers.create({
    name: params.clientName,
    email: params.email,
    metadata: {
      org_id: params.orgId,
      client_id: params.clientId,
    },
  });

  return customer.id;
}

export async function createAndSendStripeInvoice(params: {
  customerId: string;
  reference: StripeInvoiceReferencePayload;
  currency: string;
  dueDate: string;
  items: StripeInvoiceLineItem[];
}) {
  const stripe = getStripeClient();
  const metadata = buildStripeInvoiceMetadata(params.reference);

  for (const item of params.items) {
    if (!item.unitAmount) {
      continue;
    }

    await stripe.invoiceItems.create({
      customer: params.customerId,
      currency: params.currency.toLowerCase(),
      description: item.description,
      amount: Math.round(item.unitAmount * (item.quantity ?? 1) * 100),
      metadata,
    });
  }

  const dueDateUnix = Math.floor(new Date(params.dueDate).getTime() / 1000);
  const createdInvoice = await stripe.invoices.create({
    customer: params.customerId,
    collection_method: "send_invoice",
    due_date: Number.isFinite(dueDateUnix) ? dueDateUnix : undefined,
    auto_advance: false,
    metadata,
  });

  const finalized = await stripe.invoices.finalizeInvoice(createdInvoice.id);
  const sentInvoice = await stripe.invoices.sendInvoice(finalized.id);

  return {
    stripeInvoiceId: sentInvoice.id,
    stripePaymentIntentId: getInvoicePaymentIntentId(
      sentInvoice as Stripe.Invoice & {
        payment_intent?: string | Stripe.PaymentIntent | null;
      }
    ),
  };
}

export async function sendExistingStripeInvoice(params: {
  stripeInvoiceId: string;
  reference: StripeInvoiceReferencePayload;
  stripePaymentIntentId?: string | null;
}) {
  await syncStripeInvoiceReferences({
    ...params.reference,
    stripeInvoiceId: params.stripeInvoiceId,
    stripePaymentIntentId: params.stripePaymentIntentId ?? null,
  });

  const stripe = getStripeClient();
  const invoice = await stripe.invoices.retrieve(params.stripeInvoiceId);
  const invoiceToSend =
    invoice.status === "draft"
      ? await stripe.invoices.finalizeInvoice(invoice.id)
      : invoice;

  const sentInvoice = await stripe.invoices.sendInvoice(invoiceToSend.id);

  return {
    stripeInvoiceId: sentInvoice.id,
    stripePaymentIntentId: getInvoicePaymentIntentId(
      sentInvoice as Stripe.Invoice & {
        payment_intent?: string | Stripe.PaymentIntent | null;
      }
    ),
  };
}

export async function createStripeCreditNote(params: {
  stripeInvoiceId: string;
  amount: number;
  memo?: string | null;
  metadata: Record<string, string>;
}) {
  const stripe = getStripeClient();

  return stripe.creditNotes.create({
    invoice: params.stripeInvoiceId,
    amount: Math.round(params.amount * 100),
    memo: params.memo ?? undefined,
    metadata: params.metadata,
  });
}

export async function voidStripeInvoice(params: {
  stripeInvoiceId: string;
  reference: StripeInvoiceReferencePayload;
  stripePaymentIntentId?: string | null;
}) {
  await syncStripeInvoiceReferences({
    ...params.reference,
    stripeInvoiceId: params.stripeInvoiceId,
    stripePaymentIntentId: params.stripePaymentIntentId ?? null,
  });

  const stripe = getStripeClient();
  return stripe.invoices.voidInvoice(params.stripeInvoiceId);
}

/**
 * Get active subscription for a customer
 */
export async function getActiveSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  return subscriptions.data[0] ?? null;
}

/**
 * Map a Stripe price ID to our plan name
 */
export function priceIdToPlan(priceId: string): "free" | "pro" | "enterprise" {
  if (priceId === PRICE_IDS.pro) return "pro";
  if (priceId === PRICE_IDS.enterprise) return "enterprise";
  return "free";
}
