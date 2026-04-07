import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe, priceIdToPlan } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";

// Use service role for webhook handler (no user context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
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
        console.log(`Unhandled event type: ${event.type}`);
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
  const orgId = session.metadata?.org_id;
  if (!orgId) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  // Fetch the subscription to get the plan
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
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
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  // Find org by customer ID
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (org) {
    await supabaseAdmin.from("activity_log").insert({
      org_id: org.id,
      entity_type: "billing",
      entity_id: org.id,
      action: "payment_received",
      metadata: {
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: invoice.currency,
      },
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (org) {
    await supabaseAdmin.from("activity_log").insert({
      org_id: org.id,
      entity_type: "billing",
      entity_id: org.id,
      action: "payment_failed",
      metadata: {
        amount: (invoice.amount_due ?? 0) / 100,
        currency: invoice.currency,
      },
    });
  }
}
