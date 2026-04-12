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
  refunded_amount?: number | null;
  credited_amount?: number | null;
  voided_at?: string | null;
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

async function findLinkedOrgAndInvoiceByRefs({
  customerId,
  orgIdFromMetadata,
  stripeInvoiceId,
  stripePaymentIntentId,
  appInvoiceId,
  appInvoiceNumber,
}: {
  customerId?: string | null;
  orgIdFromMetadata?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  appInvoiceId?: string | null;
  appInvoiceNumber?: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedStripeInvoiceId = stripeInvoiceId ?? null;
  const normalizedStripePaymentIntentId = stripePaymentIntentId ?? null;
  const normalizedAppInvoiceId = appInvoiceId ?? null;
  const normalizedAppInvoiceNumber = appInvoiceNumber ?? null;

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
      stripeInvoiceId: normalizedStripeInvoiceId,
      stripePaymentIntentId: normalizedStripePaymentIntentId,
    };
  }

  const lookupCandidates = [
    { column: "stripe_invoice_id", value: normalizedStripeInvoiceId },
    { column: "stripe_payment_intent_id", value: normalizedStripePaymentIntentId },
    { column: "id", value: normalizedAppInvoiceId },
    { column: "invoice_number", value: normalizedAppInvoiceNumber },
  ] as const;

  for (const candidate of lookupCandidates) {
    if (!candidate.value) {
      continue;
    }

    const { data } = await supabaseAdmin
      .from("invoices")
      .select(
        "id, org_id, invoice_number, status, amount_paid, total, refunded_amount, credited_amount, voided_at"
      )
      .eq("org_id", orgId)
      .eq(candidate.column, candidate.value)
      .maybeSingle();

    if (data) {
      return {
        supabaseAdmin,
        orgId,
        linkedInvoice: data as LinkedInvoiceRecord,
        stripeInvoiceId: normalizedStripeInvoiceId,
        stripePaymentIntentId: normalizedStripePaymentIntentId,
      };
    }
  }

  return {
    supabaseAdmin,
    orgId,
    linkedInvoice: null,
    stripeInvoiceId: normalizedStripeInvoiceId,
    stripePaymentIntentId: normalizedStripePaymentIntentId,
  };
}

async function findLinkedOrgAndInvoice(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  return findLinkedOrgAndInvoiceByRefs({
    customerId,
    orgIdFromMetadata: invoice.metadata?.org_id,
    stripeInvoiceId: getStripeInvoiceId(invoice),
    stripePaymentIntentId: getStripePaymentIntentId(invoice),
    appInvoiceId: invoice.metadata?.invoice_id,
    appInvoiceNumber: invoice.metadata?.invoice_number,
  });
}

async function hasProcessedStripeEvent(stripeEventId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("invoice_payment_events")
    .select("id")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();

  return !!data?.id;
}

async function hasProcessedRefundObject(stripeRefundId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("invoice_payment_events")
    .select("id")
    .eq("stripe_refund_id", stripeRefundId)
    .maybeSingle();

  return !!data?.id;
}

async function hasProcessedCreditNoteObject(stripeCreditNoteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("invoice_payment_events")
    .select("id")
    .eq("stripe_credit_note_id", stripeCreditNoteId)
    .maybeSingle();

  return !!data?.id;
}

async function insertPaymentEvent({
  stripeEventId,
  stripeRefundId,
  stripeCreditNoteId,
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
  stripeEventId?: string | null;
  stripeRefundId?: string | null;
  stripeCreditNoteId?: string | null;
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
    stripe_event_id: stripeEventId ?? null,
    stripe_refund_id: stripeRefundId ?? null,
    stripe_credit_note_id: stripeCreditNoteId ?? null,
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
        await handleInvoicePaid(event.id, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(event.id, invoice);
        break;
      }

      case "refund.created": {
        const refund = event.data.object as Stripe.Refund;
        await handleRefundCreated(event.id, refund);
        break;
      }

      case "credit_note.created": {
        const creditNote = event.data.object as Stripe.CreditNote;
        await handleCreditNoteCreated(event.id, creditNote);
        break;
      }

      case "invoice.voided": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceVoided(event.id, invoice);
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

async function handleInvoicePaid(stripeEventId: string, invoice: Stripe.Invoice) {
  if (await hasProcessedStripeEvent(stripeEventId)) {
    return;
  }

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
    stripeEventId,
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

async function handlePaymentFailed(stripeEventId: string, invoice: Stripe.Invoice) {
  if (await hasProcessedStripeEvent(stripeEventId)) {
    return;
  }

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
    stripeEventId,
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

async function handleRefundCreated(stripeEventId: string, refund: Stripe.Refund) {
  if (await hasProcessedStripeEvent(stripeEventId) || await hasProcessedRefundObject(refund.id)) {
    return;
  }

  const charge =
    typeof refund.charge === "string"
      ? await getStripeClient().charges.retrieve(refund.charge)
      : refund.charge;

  const chargeWithInvoice = charge as Stripe.Charge & {
    invoice?: string | Stripe.Invoice | null;
  };
  const invoiceId =
    typeof chargeWithInvoice.invoice === "string"
      ? chargeWithInvoice.invoice
      : chargeWithInvoice.invoice?.id;
  const paymentIntentId =
    typeof charge?.payment_intent === "string"
      ? charge.payment_intent
      : charge?.payment_intent?.id;
  const customerId =
    typeof charge?.customer === "string" ? charge.customer : charge?.customer?.id;
  const metadata = {
    ...(charge?.metadata ?? {}),
    ...(refund.metadata ?? {}),
  };

  const {
    supabaseAdmin,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
  } = await findLinkedOrgAndInvoiceByRefs({
    customerId,
    orgIdFromMetadata: metadata.org_id ?? null,
    stripeInvoiceId: invoiceId,
    stripePaymentIntentId: paymentIntentId,
    appInvoiceId: metadata.invoice_id ?? null,
    appInvoiceNumber: metadata.invoice_number ?? null,
  });

  if (!orgId) return;

  const amount = (refund.amount ?? 0) / 100;
  const nextRefundedAmount = Number(linkedInvoice?.refunded_amount ?? 0) + amount;
  const remainingBalance = linkedInvoice
    ? Math.max(Number(linkedInvoice.total) - Math.max(Number(linkedInvoice.amount_paid) - nextRefundedAmount, 0) - Number(linkedInvoice.credited_amount ?? 0), 0)
    : 0;
  const eventMetadata = {
    amount,
    currency: refund.currency ?? charge?.currency ?? null,
    stripe_invoice_id: stripeInvoiceId,
    stripe_payment_intent_id: stripePaymentIntentId,
    stripe_refund_id: refund.id,
    linked_invoice_id: linkedInvoice?.id ?? null,
    linked_invoice_number: linkedInvoice?.invoice_number ?? null,
    billing_reference: linkedInvoice
      ? buildInvoiceBillingReference(
          linkedInvoice.org_id,
          linkedInvoice.id,
          linkedInvoice.invoice_number
        )
      : null,
    resulting_refunded_amount: nextRefundedAmount,
    resulting_balance: remainingBalance,
  };

  if (linkedInvoice) {
    await supabaseAdmin
      .from("invoices")
      .update({
        refunded_amount: nextRefundedAmount,
      })
      .eq("id", linkedInvoice.id);
  }

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: linkedInvoice?.id ?? orgId,
    action: "payment_refunded",
    metadata: eventMetadata,
  });

  await insertPaymentEvent({
    stripeEventId,
    stripeRefundId: refund.id,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
    eventType: "payment_refunded",
    status: "refunded",
    amount,
    currency: refund.currency ?? charge?.currency ?? null,
    metadata: {
      ...eventMetadata,
      invoice_id: linkedInvoice?.id ?? null,
      invoice_number: linkedInvoice?.invoice_number ?? null,
    },
  });
}

async function handleCreditNoteCreated(
  stripeEventId: string,
  creditNote: Stripe.CreditNote
) {
  if (
    (await hasProcessedStripeEvent(stripeEventId)) ||
    (await hasProcessedCreditNoteObject(creditNote.id))
  ) {
    return;
  }

  const {
    supabaseAdmin,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
  } = await findLinkedOrgAndInvoiceByRefs({
    customerId:
      typeof creditNote.customer === "string"
        ? creditNote.customer
        : creditNote.customer?.id,
    stripeInvoiceId:
      typeof creditNote.invoice === "string"
        ? creditNote.invoice
        : creditNote.invoice?.id,
  });

  if (!orgId) return;

  const amount = (creditNote.amount ?? 0) / 100;
  const nextCreditedAmount = Number(linkedInvoice?.credited_amount ?? 0) + amount;
  const remainingBalance = linkedInvoice
    ? Math.max(Number(linkedInvoice.total) - Math.max(Number(linkedInvoice.amount_paid) - Number(linkedInvoice.refunded_amount ?? 0), 0) - nextCreditedAmount, 0)
    : 0;
  const eventMetadata = {
    amount,
    currency: creditNote.currency,
    stripe_invoice_id: stripeInvoiceId,
    linked_invoice_id: linkedInvoice?.id ?? null,
    linked_invoice_number: linkedInvoice?.invoice_number ?? null,
    billing_reference: linkedInvoice
      ? buildInvoiceBillingReference(
          linkedInvoice.org_id,
          linkedInvoice.id,
          linkedInvoice.invoice_number
        )
      : null,
    credit_note_id: creditNote.id,
    stripe_credit_note_id: creditNote.id,
    resulting_credited_amount: nextCreditedAmount,
    resulting_balance: remainingBalance,
  };

  if (linkedInvoice) {
    await supabaseAdmin
      .from("invoices")
      .update({
        credited_amount: nextCreditedAmount,
      })
      .eq("id", linkedInvoice.id);
  }

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: linkedInvoice?.id ?? orgId,
    action: "invoice.credited",
    metadata: eventMetadata,
  });

  await insertPaymentEvent({
    stripeEventId,
    stripeCreditNoteId: creditNote.id,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId: null,
    eventType: "invoice.credited",
    status: "credited",
    amount,
    currency: creditNote.currency,
    metadata: {
      ...eventMetadata,
      invoice_id: linkedInvoice?.id ?? null,
      invoice_number: linkedInvoice?.invoice_number ?? null,
    },
  });
}

async function handleInvoiceVoided(stripeEventId: string, invoice: Stripe.Invoice) {
  if (await hasProcessedStripeEvent(stripeEventId)) {
    return;
  }

  const {
    supabaseAdmin,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
  } = await findLinkedOrgAndInvoice(invoice);

  if (!orgId) return;

  const eventMetadata = {
    amount: (invoice.amount_due ?? 0) / 100,
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
        voided_at: new Date().toISOString(),
        status: "cancelled",
      })
      .eq("id", linkedInvoice.id);
  }

  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    entity_type: "billing",
    entity_id: linkedInvoice?.id ?? orgId,
    action: "invoice.voided",
    metadata: eventMetadata,
  });

  await insertPaymentEvent({
    stripeEventId,
    orgId,
    linkedInvoice,
    stripeInvoiceId,
    stripePaymentIntentId,
    eventType: "invoice.voided",
    status: "voided",
    amount: (invoice.amount_due ?? 0) / 100,
    currency: invoice.currency,
    metadata: {
      ...eventMetadata,
      invoice_id: linkedInvoice?.id ?? null,
      invoice_number: linkedInvoice?.invoice_number ?? null,
    },
  });
}
