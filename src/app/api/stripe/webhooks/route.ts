import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient, priceIdToPlan } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import { buildInvoiceBillingReference } from "@/lib/invoices/reference";
import {
  getStripeWebhookSecret,
  getSupabaseConfig,
  getSupabaseServiceRoleKey,
} from "@/lib/env";

function getSupabaseAdmin() {
  const { url } = getSupabaseConfig();
  return createClient(url, getSupabaseServiceRoleKey());
}

type LinkedInvoiceRecord = {
  id: string;
  org_id: string;
  invoice_number: string;
  status: string;
  amount_paid: number;
  total: number;
};

function getStripeInvoiceId(invoice: Stripe.Invoice) {
  return invoice.id ?? null;
}

function getStripePaymentIntentId(invoice: Stripe.Invoice) {
  const paymentIntent = (invoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
  }).payment_intent;

  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

async function findLinkedOrgAndInvoice(invoice: Stripe.Invoice) {
  const supabaseAdmin = getSupabaseAdmin();
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  const orgIdFromMetadata = invoice.metadata?.org_id;
  const stripeInvoiceId = getStripeInvoiceId(invoice);
  const stripePaymentIntentId = getStripePaymentIntentId(invoice);
  const appInvoiceId = invoice.metadata?.invoice_id;
  const appInvoiceNumber = invoice.metadata?.invoice_number;

  let orgId = orgIdFromMetadata ?? null;

  if (!orgId && customerId) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    orgId = org?.id ?? null;
  }

  if (!orgId) {
    return {
      supabaseAdmin,
      orgId: null,
      linkedInvoice: null,
      stripeInvoiceId,
      stripePaymentIntentId,
    };
  }

  const lookupCandidates = [
    { column: "stripe_invoice_id", value: stripeInvoiceId },
    { column: "stripe_payment_intent_id", value: stripePaymentIntentId },
    { column: "id", value: appInvoiceId },
    { column: "invoice_number", value: appInvoiceNumber },
  ] as const;

  for (const candidate of lookupCandidates) {
    if (!candidate.value) {
      continue;
    }

    const { data } = await supabaseAdmin
      .from("invoices")
      .select("id, org_id, invoice_number, status, amount_paid, total")
      .eq("org_id", orgId)
      .eq(candidate.column, candidate.value)
      .maybeSingle();

    if (data) {
      return {
        supabaseAdmin,
        orgId,
        linkedInvoice: data as LinkedInvoiceRecord,
        stripeInvoiceId,
        stripePaymentIntentId,
      };
    }
  }

  return {
    supabaseAdmin,
    orgId,
    linkedInvoice: null,
    stripeInvoiceId,
    stripePaymentIntentId,
  };
}

async function insertPaymentEvent({
  orgId,
  linkedInvoice,
  stripeInvoiceId,
  stripePaymentIntentId,
  eventType,
  status,
  amount,
  currency,
  metadata,
}: {
  orgId: string;
  linkedInvoice: LinkedInvoiceRecord | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  eventType: string;
  status:
    | "pending"
    | "succeeded"
    | "failed"
    | "reviewed"
    | "refunded"
    | "credited"
    | "voided";
  amount: number;
  currency: string | null;
  metadata: Record<string, unknown>;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  await supabaseAdmin.from("invoice_payment_events").insert({
    org_id: orgId,
    invoice_id: linkedInvoice?.id ?? null,
    actor_user_id: null,
    stripe_invoice_id: stripeInvoiceId,
    stripe_payment_intent_id: stripePaymentIntentId,
    source: "stripe",
    event_type: eventType,
    status,
    amount,
    currency,
    metadata,
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabaseAdmin = getSupabaseAdmin();
  const orgId = session.metadata?.org_id;
  if (!orgId) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  // Fetch the subscription to get the plan
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceIdToPlan(priceId ?? "");

  await supabaseAdmin
    .from("organizations")
    .update({
      plan,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
    })
    .eq("id", orgId);

  // Log activity
  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: orgId,
    action: "plan_upgraded",
    metadata: { plan, subscription_id: subscriptionId },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabaseAdmin = getSupabaseAdmin();
  const orgId = subscription.metadata?.org_id;
  if (!orgId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceIdToPlan(priceId ?? "");

  await supabaseAdmin
    .from("organizations")
    .update({
      plan,
      stripe_subscription_id: subscription.id,
    })
    .eq("id", orgId);

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: orgId,
    action: "subscription_updated",
    metadata: { plan, status: subscription.status },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabaseAdmin = getSupabaseAdmin();
  const orgId = subscription.metadata?.org_id;
  if (!orgId) return;

  // Downgrade to free
  await supabaseAdmin
    .from("organizations")
    .update({
      plan: "free",
      stripe_subscription_id: null,
    })
    .eq("id", orgId);

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: orgId,
    action: "subscription_cancelled",
    metadata: { previous_plan: priceIdToPlan(subscription.items.data[0]?.price.id ?? "") },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const {
    supabaseAdmin,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
  } = await findLinkedOrgAndInvoice(invoice);

  if (!orgId) return;

  const amount = (invoice.amount_paid ?? 0) / 100;
  const metadata = {
    amount,
    currency: invoice.currency,
    stripe_invoice_id: stripeInvoiceId,
    stripe_payment_intent_id: stripePaymentIntentId,
    stripe_invoice_number: invoice.number,
    linked_invoice_id: linkedInvoice?.id ?? null,
    linked_invoice_number: linkedInvoice?.invoice_number ?? null,
    billing_reference: linkedInvoice
      ? buildInvoiceBillingReference(
          linkedInvoice.org_id,
          linkedInvoice.id,
          linkedInvoice.invoice_number
        )
      : null,
  };

  if (linkedInvoice) {
    await supabaseAdmin
      .from("invoices")
      .update({
        stripe_invoice_id: stripeInvoiceId,
        stripe_payment_intent_id: stripePaymentIntentId,
        last_payment_received_at: new Date().toISOString(),
      })
      .eq("id", linkedInvoice.id);
  }

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: linkedInvoice?.id ?? orgId,
    action: "payment_received",
    metadata,
  });

  await insertPaymentEvent({
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
    eventType: "payment_received",
    status: "succeeded",
    amount,
    currency: invoice.currency,
    metadata: {
      ...metadata,
      invoice_id: linkedInvoice?.id ?? null,
      invoice_number: linkedInvoice?.invoice_number ?? null,
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const {
    supabaseAdmin,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
  } = await findLinkedOrgAndInvoice(invoice);

  if (!orgId) return;

  const amount = (invoice.amount_due ?? 0) / 100;
  const metadata = {
    amount,
    currency: invoice.currency,
    stripe_invoice_id: stripeInvoiceId,
    stripe_payment_intent_id: stripePaymentIntentId,
    stripe_invoice_number: invoice.number,
    linked_invoice_id: linkedInvoice?.id ?? null,
    linked_invoice_number: linkedInvoice?.invoice_number ?? null,
    billing_reference: linkedInvoice
      ? buildInvoiceBillingReference(
          linkedInvoice.org_id,
          linkedInvoice.id,
          linkedInvoice.invoice_number
        )
      : null,
  };

  if (linkedInvoice) {
    await supabaseAdmin
      .from("invoices")
      .update({
        stripe_invoice_id: stripeInvoiceId,
        stripe_payment_intent_id: stripePaymentIntentId,
        last_payment_failed_at: new Date().toISOString(),
      })
      .eq("id", linkedInvoice.id);
  }

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: linkedInvoice?.id ?? orgId,
    action: "payment_failed",
    metadata,
  });

  await insertPaymentEvent({
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
    eventType: "payment_failed",
    status: "failed",
    amount,
    currency: invoice.currency,
    metadata: {
      ...metadata,
      invoice_id: linkedInvoice?.id ?? null,
      invoice_number: linkedInvoice?.invoice_number ?? null,
    },
  });
}
