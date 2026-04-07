import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

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
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Get active subscription for a customer
 */
export async function getActiveSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
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
