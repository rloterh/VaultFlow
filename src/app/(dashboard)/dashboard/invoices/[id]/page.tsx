"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  ExternalLink,
  FileText,
  History,
  Send,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useStripePortal } from "@/hooks/use-stripe";
import {
  getActivityLabel,
  getActivitySubject,
} from "@/lib/activity/presentation";
import {
  getInvoiceCollectionsMessage,
  getInvoiceTransitions,
  transitionInvoiceStatus,
} from "@/lib/invoices/lifecycle";
import {
  canRecordReminder,
  getLatestReminderEntry,
  getReminderEntryLabel,
  getReminderRecommendation,
  recordInvoiceReminder,
} from "@/lib/invoices/follow-up";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import {
  buildInvoiceHistoryEvents,
  filterInvoiceHistoryEntries,
  type InvoiceHistoryEntryRecord,
} from "@/lib/invoices/history";
import { getInvoicePaymentSummary } from "@/lib/invoices/payments";
import { buildInvoiceBillingReference, buildInvoiceIdentifiers } from "@/lib/invoices/reference";
import { buildWorkflowAccountabilityMap } from "@/lib/operations/accountability";
import {
  fetchVendorAssignedClientIds,
  isVendorRole,
} from "@/lib/rbac/vendor-access";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Client, Invoice, InvoiceItem, InvoicePaymentEvent } from "@/types/database";

interface InvoiceActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null; email?: string | null } | null;
}

type InvoiceDetailRecord = Omit<Invoice, "client"> & {
  client?: Client | null;
  items?: InvoiceItem[];
};

const LEDGER_EVENT_ACTIONS = new Set([
  "payment_recorded",
  "payment_received",
  "payment_failed",
  "payment_refunded",
  "invoice.credited",
  "invoice.voided",
  "invoice.recovery_reviewed",
  "invoice.payment_recorded",
]);

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const transitionIconMap = {
  draft: FileText,
  sent: Send,
  viewed: Eye,
  paid: CheckCircle2,
  overdue: AlertTriangle,
  cancelled: XCircle,
};

function getNextLifecycleStatus(
  currentStatus: Invoice["status"],
  dueDate: string,
  outstandingAmount: number,
  voidedAt?: string | null
): Invoice["status"] {
  if (voidedAt) {
    return "cancelled";
  }

  if (outstandingAmount <= 0) {
    return "paid";
  }

  if (currentStatus === "draft" || currentStatus === "cancelled") {
    return currentStatus;
  }

  return new Date(dueDate).getTime() < Date.now() ? "overdue" : "viewed";
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { can, role } = usePermissions();
  const { currentOrg } = useOrgStore();
  const { openPortal, isLoading: portalLoading } = useStripePortal();
  const addToast = useUIStore((s) => s.addToast);
  const [invoice, setInvoice] = useState<InvoiceDetailRecord | null>(null);
  const [activity, setActivity] = useState<InvoiceActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [recordingReminder, setRecordingReminder] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [ledgerActionLoading, setLedgerActionLoading] = useState<string | null>(null);
  const [stripeInvoiceIdInput, setStripeInvoiceIdInput] = useState("");
  const [stripePaymentIntentIdInput, setStripePaymentIntentIdInput] = useState("");
  const [savingStripeLink, setSavingStripeLink] = useState(false);
  const intent = searchParams.get("intent");

  const fetchInvoice = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    let invoiceQuery = sb
      .from("invoices")
      .select("*, client:clients(*), items:invoice_items(*)")
      .eq("id", id);
    if (isVendorRole(role)) {
      const assignedClientIds = await fetchVendorAssignedClientIds(
        sb,
        currentOrg?.id ?? "",
        user?.id
      );
      if (assignedClientIds.length === 0) {
        setInvoice(null);
        setActivity([]);
        setLoading(false);
        return;
      }

      invoiceQuery = invoiceQuery.in("client_id", assignedClientIds);
    }

    const invoiceRes = await invoiceQuery.single();
    const nextInvoice = (invoiceRes.data as InvoiceDetailRecord | null) ?? null;

    if (!nextInvoice) {
      setInvoice(null);
      setActivity([]);
      setLoading(false);
      return;
    }

    const [activityRes, paymentEventRes] = await Promise.all([
      sb
        .from("activity_log")
        .select("id, action, entity_type, entity_id, metadata, created_at, profile:profiles(full_name, avatar_url, email)")
        .eq("org_id", nextInvoice.org_id)
        .order("created_at", { ascending: false })
        .limit(60),
      sb
        .from("invoice_payment_events")
        .select(
          "id, invoice_id, event_type, amount, currency, metadata, created_at, actor_user_id, actor:profiles(full_name, avatar_url, email)"
        )
        .eq("org_id", nextInvoice.org_id)
        .eq("invoice_id", nextInvoice.id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const filteredActivity = filterInvoiceHistoryEntries(
      (activityRes.data ?? []).map((entry) => ({
        ...(entry as Omit<InvoiceActivityEntry, "profile">),
        profile: Array.isArray(entry.profile)
          ? entry.profile[0] ?? null
          : entry.profile ?? null,
      })),
      nextInvoice.id,
      nextInvoice.invoice_number
    ).filter((entry) => !LEDGER_EVENT_ACTIONS.has(entry.action)) as InvoiceActivityEntry[];

    const paymentHistory = ((paymentEventRes.data ?? []) as Array<
      Pick<
        InvoicePaymentEvent,
        "id" | "invoice_id" | "event_type" | "amount" | "currency" | "metadata" | "created_at"
      > & {
        actor?: {
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
        } | null;
      }
    >).map((entry) => ({
      id: entry.id,
      action: entry.event_type,
      entity_type: "invoice",
      entity_id: entry.invoice_id ?? nextInvoice.id,
      metadata: {
        invoice_id: nextInvoice.id,
        invoice_number: nextInvoice.invoice_number,
        amount: entry.amount,
        currency: entry.currency,
        ...entry.metadata,
      },
      created_at: entry.created_at,
      profile: Array.isArray(entry.actor)
        ? entry.actor[0] ?? null
        : entry.actor ?? null,
    }));

    setInvoice(nextInvoice);
    setActivity(
      [...filteredActivity, ...paymentHistory].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      )
    );
    setLoading(false);
  }, [currentOrg?.id, id, role, user?.id]);

  useEffect(() => {
    if (id) {
      void fetchInvoice();
    }
  }, [fetchInvoice, id]);

  async function handleStatusTransition(nextStatus: Invoice["status"]) {
    if (!invoice) {
      return;
    }

    setUpdatingStatus(nextStatus);
    try {
      const updated = await transitionInvoiceStatus(invoice, nextStatus, user?.id);
      setInvoice(updated);
      await fetchInvoice();
      addToast({
        type: "success",
        title: `Invoice ${nextStatus}`,
        description: `${invoice.invoice_number} was updated successfully.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "The invoice could not be updated.",
      });
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleRecordReminder() {
    if (!invoice) {
      return;
    }

    setRecordingReminder(true);
    const success = await recordInvoiceReminder(invoice, user?.id);

    if (!success) {
      addToast({
        type: "error",
        title: "Reminder could not be recorded",
        description: "Try again after the activity log reconnects.",
      });
      setRecordingReminder(false);
      return;
    }

    await fetchInvoice();
    addToast({
      type: "success",
      title: "Reminder recorded",
      description: `A follow-up touchpoint was recorded for ${invoice.invoice_number}.`,
    });
    setRecordingReminder(false);
  }

  async function recordBillingTimelineEvent(
    targetInvoice: InvoiceDetailRecord,
    action: string,
    metadata: Record<string, unknown>
  ) {
    const sb = getSupabaseBrowserClient();

    await sb.from("activity_log").insert({
      org_id: targetInvoice.org_id,
      user_id: user?.id ?? null,
      entity_type: "billing",
      entity_id: targetInvoice.id,
      action,
      metadata: {
        ...buildInvoiceIdentifiers(targetInvoice),
        ...metadata,
      },
    });
  }

  async function recordPayment() {
    if (!invoice || !user) {
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast({
        type: "error",
        title: "Invalid payment amount",
        description: "Enter a positive value to record payment.",
      });
      return;
    }

    const currentPaid = Number(invoice.amount_paid) || 0;
    const total = Number(invoice.total) || 0;
    const maxGrossCollection = total + Number(invoice.refunded_amount ?? 0);
    const nextPaid = Math.min(currentPaid + amount, maxGrossCollection);
    const nextSummary = getInvoicePaymentSummary({
      ...invoice,
      amount_paid: nextPaid,
    });
    const balance = nextSummary.outstandingAmount;
    const nextStatus = getNextLifecycleStatus(
      invoice.status,
      invoice.due_date,
      balance,
      invoice.voided_at ?? null
    );
    const nowIso = new Date().toISOString();

    setRecordingPayment(true);
    const sb = getSupabaseBrowserClient();

    const { error: invoiceError } = await sb
      .from("invoices")
      .update({
        amount_paid: nextPaid,
        status: nextStatus,
        paid_at: balance === 0 ? nowIso : invoice.paid_at,
        last_payment_received_at: nowIso,
      })
      .eq("id", invoice.id);

    if (invoiceError) {
      addToast({
        type: "error",
        title: "Payment recording failed",
        description: invoiceError.message,
      });
      setRecordingPayment(false);
      return;
    }

    await sb.from("activity_log").insert({
      org_id: invoice.org_id,
      user_id: user.id,
      entity_type: "billing",
      entity_id: invoice.id,
      action: "payment_recorded",
      metadata: {
        ...buildInvoiceIdentifiers(invoice),
        amount,
        resulting_amount_paid: nextPaid,
        resulting_balance: balance,
        fully_paid: balance === 0,
        source: "manual_reconciliation",
      },
    });

    await sb.from("invoice_payment_events").insert({
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      actor_user_id: user.id,
      source: "workspace",
      event_type: "payment_recorded",
      status: balance === 0 ? "succeeded" : "reviewed",
      amount,
      currency: invoice.currency,
      metadata: {
        ...buildInvoiceIdentifiers(invoice),
        resulting_amount_paid: nextPaid,
        resulting_balance: balance,
        fully_paid: balance === 0,
        source: "manual_reconciliation",
      },
    });

    await logInvoiceActivity({
      orgId: invoice.org_id,
      userId: user.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      action: "invoice.payment_recorded",
      metadata: {
        ...buildInvoiceIdentifiers(invoice),
        amount,
        resulting_amount_paid: nextPaid,
        resulting_balance: balance,
        fully_paid: balance === 0,
        source: "manual_reconciliation",
      },
    });

    await recordBillingTimelineEvent(invoice, "payment_recorded", {
      amount,
      resulting_amount_paid: nextPaid,
      resulting_balance: balance,
      fully_paid: balance === 0,
      source: "manual_reconciliation",
    });

    setPaymentAmount("");
    setRecordingPayment(false);
    await fetchInvoice();
    addToast({
      type: "success",
      title: balance === 0 ? "Invoice settled" : "Payment recorded",
      description:
        balance === 0
          ? `${invoice.invoice_number} is now fully reconciled.`
          : `${fmt(amount)} applied. ${fmt(balance)} still outstanding.`,
    });
  }

  async function logRecoveryReview() {
    if (!invoice) {
      return;
    }

    const nowIso = new Date().toISOString();
    const sb = getSupabaseBrowserClient();

    await sb
      .from("invoices")
      .update({
        last_recovery_reviewed_at: nowIso,
      })
      .eq("id", invoice.id);

    await logInvoiceActivity({
      orgId: invoice.org_id,
      userId: user?.id ?? null,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      action: "invoice.recovery_reviewed",
      metadata: {
        ...buildInvoiceIdentifiers(invoice),
        outstanding_amount: paymentSummary.outstandingAmount,
        collected_amount: paymentSummary.netCollectedAmount,
        source_intent: intent ?? "inline",
      },
    });

    await sb.from("invoice_payment_events").insert({
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      actor_user_id: user?.id ?? null,
      source: "workspace",
      event_type: "invoice.recovery_reviewed",
      status: "reviewed",
      amount: paymentSummary.outstandingAmount,
      currency: invoice.currency,
      metadata: {
        ...buildInvoiceIdentifiers(invoice),
        outstanding_amount: paymentSummary.outstandingAmount,
        collected_amount: paymentSummary.netCollectedAmount,
        source_intent: intent ?? "inline",
      },
    });

    await recordBillingTimelineEvent(invoice, "invoice.recovery_reviewed", {
      outstanding_amount: paymentSummary.outstandingAmount,
      collected_amount: paymentSummary.netCollectedAmount,
      source_intent: intent ?? "inline",
    });

    await fetchInvoice();
    addToast({
      type: "success",
      title: "Recovery review logged",
      description: "This invoice now has an explicit collections review event in its timeline.",
    });
  }

  async function handleStripeLinkSave() {
    if (!invoice || !canManageLedger) {
      return;
    }

    const nextStripeInvoiceId = stripeInvoiceIdInput.trim() || null;
    const nextStripePaymentIntentId = stripePaymentIntentIdInput.trim() || null;

    setSavingStripeLink(true);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb
      .from("invoices")
      .update({
        stripe_invoice_id: nextStripeInvoiceId,
        stripe_payment_intent_id: nextStripePaymentIntentId,
      })
      .eq("id", invoice.id);

    if (error) {
      addToast({
        type: "error",
        title: "Stripe linkage failed",
        description: error.message,
      });
      setSavingStripeLink(false);
      return;
    }

    await logInvoiceActivity({
      orgId: invoice.org_id,
      userId: user?.id ?? null,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      action: "invoice.stripe_linked",
      metadata: {
        ...buildInvoiceIdentifiers(invoice),
        next_stripe_invoice_id: nextStripeInvoiceId,
        next_stripe_payment_intent_id: nextStripePaymentIntentId,
      },
    });

    await recordBillingTimelineEvent(invoice, "invoice.stripe_linked", {
      next_stripe_invoice_id: nextStripeInvoiceId,
      next_stripe_payment_intent_id: nextStripePaymentIntentId,
    });

    setSavingStripeLink(false);
    await fetchInvoice();
    addToast({
      type: "success",
      title: "Stripe linkage saved",
      description:
        "Invoice identifiers were stored so future Stripe events can attach more reliably.",
    });
  }

  async function applyLedgerAdjustment(kind: "refund" | "credit" | "void") {
    if (!invoice || !canManageLedger) {
      return;
    }

    const sb = getSupabaseBrowserClient();
    const nowIso = new Date().toISOString();
    const note = adjustmentNote.trim();
    const currentCredited = Number(invoice.credited_amount ?? 0);
    const currentRefunded = Number(invoice.refunded_amount ?? 0);
    const adjustment = Number(adjustmentAmount);
    const maxRefundable = Math.max(
      Number(invoice.amount_paid ?? 0) - currentRefunded,
      0
    );
    const maxCreditable = Math.max(paymentSummary.outstandingAmount, 0);

    if (kind !== "void" && (!Number.isFinite(adjustment) || adjustment <= 0)) {
      addToast({
        type: "error",
        title: "Invalid adjustment amount",
        description: "Enter a positive amount before applying this billing action.",
      });
      return;
    }

    if (kind === "refund" && adjustment > maxRefundable) {
      addToast({
        type: "error",
        title: "Refund exceeds collected cash",
        description: `Only ${fmt(maxRefundable)} is currently available to refund on this invoice.`,
      });
      return;
    }

    if (kind === "credit" && adjustment > maxCreditable) {
      addToast({
        type: "error",
        title: "Credit exceeds remaining balance",
        description: `Only ${fmt(maxCreditable)} remains open on this invoice.`,
      });
      return;
    }

    const nextInvoiceSnapshot: InvoiceDetailRecord =
      kind === "refund"
        ? {
            ...invoice,
            refunded_amount: currentRefunded + adjustment,
          }
        : kind === "credit"
          ? {
              ...invoice,
              credited_amount: currentCredited + adjustment,
            }
          : {
              ...invoice,
              voided_at: nowIso,
            };

    const nextSummary = getInvoicePaymentSummary(nextInvoiceSnapshot);
    const nextStatus =
      kind === "void"
        ? "cancelled"
        : getNextLifecycleStatus(
            invoice.status,
            invoice.due_date,
            nextSummary.outstandingAmount,
            nextInvoiceSnapshot.voided_at ?? null
          );

    const updates =
      kind === "refund"
        ? {
            refunded_amount: currentRefunded + adjustment,
            status: nextStatus,
            last_recovery_reviewed_at: nowIso,
          }
        : kind === "credit"
          ? {
              credited_amount: currentCredited + adjustment,
              status: nextStatus,
              paid_at: nextStatus === "paid" ? invoice.paid_at ?? nowIso : invoice.paid_at,
              last_recovery_reviewed_at: nowIso,
            }
          : {
              voided_at: nowIso,
              status: "cancelled" as const,
              last_recovery_reviewed_at: nowIso,
            };

    const eventAction =
      kind === "refund"
        ? "payment_refunded"
        : kind === "credit"
          ? "invoice.credited"
          : "invoice.voided";
    const eventStatus =
      kind === "refund"
        ? "refunded"
        : kind === "credit"
          ? "credited"
          : "voided";

    setLedgerActionLoading(kind);
    const { error } = await sb.from("invoices").update(updates).eq("id", invoice.id);

    if (error) {
      addToast({
        type: "error",
        title: "Billing adjustment failed",
        description: error.message,
      });
      setLedgerActionLoading(null);
      return;
    }

    const metadata = {
      ...buildInvoiceIdentifiers(invoice),
      amount: kind === "void" ? paymentSummary.outstandingAmount : adjustment,
      adjustment_note: note || null,
      resulting_balance: nextSummary.outstandingAmount,
      resulting_credited_amount:
        kind === "credit" ? currentCredited + adjustment : currentCredited,
      resulting_refunded_amount:
        kind === "refund" ? currentRefunded + adjustment : currentRefunded,
      next_status: nextStatus,
      source: "invoice_detail",
    };

    await sb.from("invoice_payment_events").insert({
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      actor_user_id: user?.id ?? null,
      stripe_invoice_id: stripeInvoiceIdInput.trim() || invoice.stripe_invoice_id || null,
      stripe_payment_intent_id:
        stripePaymentIntentIdInput.trim() || invoice.stripe_payment_intent_id || null,
      source: "workspace",
      event_type: eventAction,
      status: eventStatus,
      amount: kind === "void" ? paymentSummary.outstandingAmount : adjustment,
      currency: invoice.currency,
      metadata,
    });

    await logInvoiceActivity({
      orgId: invoice.org_id,
      userId: user?.id ?? null,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      action: eventAction,
      metadata,
    });

    await recordBillingTimelineEvent(invoice, eventAction, metadata);

    setAdjustmentAmount("");
    setAdjustmentNote("");
    setLedgerActionLoading(null);
    await fetchInvoice();
    addToast({
      type: "success",
      title:
        kind === "refund"
          ? "Refund recorded"
          : kind === "credit"
            ? "Credit applied"
            : "Invoice voided",
      description:
        kind === "refund"
          ? `${fmt(adjustment)} was returned and the recovery ledger has been updated.`
          : kind === "credit"
            ? `${fmt(adjustment)} was applied against the remaining balance.`
            : `${invoice.invoice_number} has been removed from active recovery.`,
    });
  }

  const canUpdateInvoices = can("invoices:update");
  const canManageBilling = can("org:billing");
  const transitions = invoice ? getInvoiceTransitions(invoice.status) : [];
  const client = invoice?.client ?? null;
  const latestReminder = getLatestReminderEntry(activity);
  const items = useMemo(
    () => [...(invoice?.items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [invoice?.items]
  );
  const accountability = useMemo(
    () => buildWorkflowAccountabilityMap(activity).get(id) ?? null,
    [activity, id]
  );
  const paymentSummary = useMemo(
    () =>
      invoice
        ? getInvoicePaymentSummary(invoice)
        : {
            collectedAmount: 0,
            netCollectedAmount: 0,
            creditedAmount: 0,
            refundedAmount: 0,
            effectiveSettledAmount: 0,
            outstandingAmount: 0,
            isSettled: false,
            isPartial: false,
            isVoided: false,
            paymentProgress: 0,
            collectionLabel: "Awaiting collection",
            collectionTone: "default" as const,
          },
    [invoice]
  );
  const historyEvents = useMemo(
    () =>
      buildInvoiceHistoryEvents(
        activity.map((entry) => ({
          id: entry.id,
          action: entry.action,
          entity_id: entry.entity_id,
          created_at: entry.created_at,
          metadata: entry.metadata ?? {},
          actor: {
            full_name: entry.profile?.full_name ?? null,
            email: entry.profile?.email ?? null,
          },
        })) as InvoiceHistoryEntryRecord[]
      ),
    [activity]
  );

  useEffect(() => {
    if (!invoice || !intent || paymentAmount || paymentSummary.isSettled) {
      return;
    }

    if (intent === "record-payment") {
      setPaymentAmount(String(paymentSummary.outstandingAmount));
    }
  }, [intent, invoice, paymentAmount, paymentSummary.isSettled, paymentSummary.outstandingAmount]);
  useEffect(() => {
    if (!invoice?.id) {
      return;
    }

    setStripeInvoiceIdInput(invoice.stripe_invoice_id ?? "");
    setStripePaymentIntentIdInput(invoice.stripe_payment_intent_id ?? "");
  }, [invoice?.id, invoice?.stripe_invoice_id, invoice?.stripe_payment_intent_id]);
  const canRecordPayment =
    invoice?.status !== "draft" &&
    invoice?.status !== "cancelled" &&
    !paymentSummary.isSettled;
  const canManageLedger = canManageBilling;
  const recoveryGuidance = paymentSummary.isSettled
    ? {
        title: "Collections complete",
        detail: "This invoice is fully settled. Keep the payment history below as your audit trail.",
        tone: "success" as const,
      }
    : invoice?.status === "draft" || invoice?.status === "cancelled"
      ? {
          title: "Invoice is not collectible",
          detail: "Draft and cancelled invoices should not enter recovery until they are sent live again.",
          tone: "default" as const,
        }
      : invoice?.status === "overdue" && paymentSummary.isPartial
        ? {
            title: "Escalate remaining balance",
            detail: "Part of the cash is in, but a residual balance is overdue. Confirm next collection step and keep the timeline updated.",
            tone: "danger" as const,
          }
        : invoice?.status === "overdue"
          ? {
              title: "Recovery action needed",
              detail: "This invoice is overdue with open balance. Route it into collections follow-up or payment recovery immediately.",
              tone: "danger" as const,
            }
          : paymentSummary.isPartial
            ? {
                title: "Partial collection in progress",
                detail: "Some cash has landed. Record further receipts here and monitor the remaining balance until fully settled.",
                tone: "info" as const,
              }
            : {
                title: "Open balance to collect",
                detail: "Invoice is live with unpaid balance. Track payment attempts and record manual receipts here when they arrive.",
                tone: "warning" as const,
              };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-lg font-medium text-neutral-900 dark:text-white">
          {isVendorRole(role) ? "No assigned invoice found" : "Invoice not found"}
        </h2>
        <Link href="/dashboard/invoices">
          <Button variant="ghost" className="mt-4">
            Back to invoices
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/invoices">
            <button className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
              {invoice.status === "overdue" && (
                <Badge variant="warning">Collections attention</Badge>
              )}
              {intent === "record-payment" && (
                <Badge variant="info">Recovery mode</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Issued {fmtDate(invoice.issue_date)} and due {fmtDate(invoice.due_date)}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUpdateInvoices &&
            transitions.map((transition, index) => {
              const Icon = transitionIconMap[transition.status];
              return (
                <Button
                  key={transition.status}
                  variant={index === 0 && transition.tone !== "danger" ? "primary" : transition.tone === "danger" ? "danger" : "outline"}
                  isLoading={updatingStatus === transition.status}
                  leftIcon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                  onClick={() => handleStatusTransition(transition.status)}
                >
                  {transition.label}
                </Button>
              );
            })}
          <Button
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => {
              const link = document.createElement("a");
              link.href = `/api/invoices/${id}/pdf`;
              link.download = `${invoice.invoice_number}.pdf`;
              link.click();
            }}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-6 border-b border-neutral-100 pb-6 dark:border-neutral-800 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Bill to
              </p>
              <p className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">
                {client?.name ?? "Unknown"}
              </p>
              {client?.company && (
                <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                  <Building2 className="h-3.5 w-3.5" />
                  {client.company}
                </p>
              )}
              <p className="mt-1 text-sm text-neutral-500">{client?.email}</p>
              {client?.city && (
                <p className="text-sm text-neutral-500">
                  {[client.address_line1, client.city, client.state, client.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Balance remaining
              </p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-white">
                {fmt(paymentSummary.outstandingAmount)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500 md:justify-end">
                <Clock className="h-3.5 w-3.5" />
                {getInvoiceCollectionsMessage(invoice)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Description
                  </th>
                  <th className="w-24 pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Qty
                  </th>
                  <th className="w-32 pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Unit price
                  </th>
                  <th className="w-32 pb-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-neutral-50 dark:border-neutral-800/50"
                    >
                      <td className="py-3.5 text-sm text-neutral-900 dark:text-white">
                        {item.description}
                      </td>
                      <td className="py-3.5 text-right text-sm text-neutral-600 dark:text-neutral-400">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 text-right text-sm text-neutral-600 dark:text-neutral-400">
                        {fmt(Number(item.unit_price))}
                      </td>
                      <td className="py-3.5 text-right text-sm font-medium text-neutral-900 dark:text-white">
                        {fmt(Number(item.amount))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-neutral-400">
                      No line items added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="text-neutral-900 dark:text-white">
                  {fmt(Number(invoice.subtotal))}
                </span>
              </div>
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Tax ({invoice.tax_rate}%)</span>
                  <span className="text-neutral-900 dark:text-white">
                    {fmt(Number(invoice.tax_amount))}
                  </span>
                </div>
              )}
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Discount</span>
                  <span className="text-emerald-600">
                    -{fmt(Number(invoice.discount_amount))}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Total billed
                </span>
                <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {fmt(Number(invoice.total))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Net collected</span>
                <span className="text-emerald-600">
                  {fmt(paymentSummary.netCollectedAmount)}
                </span>
              </div>
              {paymentSummary.refundedAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Refunded</span>
                  <span className="text-amber-600">
                    {fmt(paymentSummary.refundedAmount)}
                  </span>
                </div>
              )}
              {paymentSummary.creditedAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Credited</span>
                  <span className="text-blue-600">
                    {fmt(paymentSummary.creditedAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Remaining</span>
                <span className="text-neutral-900 dark:text-white">
                  {fmt(paymentSummary.outstandingAmount)}
                </span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/30">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Notes
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {invoice.notes}
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-neutral-500" />
              <CardTitle>Payment operations</CardTitle>
            </div>
            <CardDescription>
              Reconcile collected cash, apply billing adjustments, and keep webhook-linked recovery history trustworthy.
            </CardDescription>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-neutral-500">Collections posture</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                  {paymentSummary.collectionLabel}
                </p>
              </div>
              <Badge
                variant={
                  paymentSummary.collectionTone === "default"
                    ? "outline"
                    : paymentSummary.collectionTone
                }
              >
                {paymentSummary.collectionLabel}
              </Badge>
            </div>
            <div className="mt-4 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${paymentSummary.paymentProgress}%` }}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Collected</p>
                <p className="mt-2 text-xl font-semibold text-neutral-900 dark:text-white">
                  {fmt(paymentSummary.netCollectedAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Remaining</p>
                <p className="mt-2 text-xl font-semibold text-neutral-900 dark:text-white">
                  {fmt(paymentSummary.outstandingAmount)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Refunded</p>
                <p className="mt-2 text-xl font-semibold text-neutral-900 dark:text-white">
                  {fmt(paymentSummary.refundedAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Credited</p>
                <p className="mt-2 text-xl font-semibold text-neutral-900 dark:text-white">
                  {fmt(paymentSummary.creditedAmount)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">Manual reconciliation</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Use this when cash was received outside an automated Stripe event and finance needs the invoice balance reflected immediately.
                  </p>
                </div>
              </div>

              {canUpdateInvoices && canRecordPayment ? (
                <div className="mt-4 space-y-3">
                  <Input
                    label="Payment amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    hint={`Current remaining balance: ${fmt(paymentSummary.outstandingAmount)}`}
                  />
                  <Button onClick={recordPayment} isLoading={recordingPayment}>
                    Record payment
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">
                  {invoice.status === "draft" || invoice.status === "cancelled"
                    ? "Payments can only be recorded once an invoice is live."
                    : canUpdateInvoices
                      ? "This invoice is already fully settled."
                      : "Your role can review payment posture here while reconciliation stays with operators."}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    Ledger adjustments
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Finance-capable roles can record refunds, credits, and voids here so the invoice ledger and recovery queue stay aligned.
                  </p>
                </div>
                <Badge variant={invoice.voided_at ? "danger" : "outline"}>
                  {invoice.voided_at ? "Voided" : "Ledger ready"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200/70 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    Credited
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                    {fmt(Number(invoice.credited_amount ?? 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/70 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    Refunded
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
                    {fmt(Number(invoice.refunded_amount ?? 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/70 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    Recovery reviewed
                  </p>
                  <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
                    {invoice.last_recovery_reviewed_at
                      ? fmtDate(invoice.last_recovery_reviewed_at)
                      : "Not yet logged"}
                  </p>
                </div>
              </div>
              {canManageLedger && !paymentSummary.isVoided ? (
                <div className="mt-4 space-y-3">
                  <Input
                    label="Adjustment amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={adjustmentAmount}
                    onChange={(event) => setAdjustmentAmount(event.target.value)}
                    hint={`Refundable: ${fmt(Math.max(Number(invoice.amount_paid ?? 0) - Number(invoice.refunded_amount ?? 0), 0))} · Creditable: ${fmt(paymentSummary.outstandingAmount)}`}
                  />
                  <Input
                    label="Adjustment note"
                    value={adjustmentNote}
                    onChange={(event) => setAdjustmentNote(event.target.value)}
                    hint="Optional context for finance audit trails and later recovery review."
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      leftIcon={<CreditCard className="h-4 w-4" />}
                      onClick={() => applyLedgerAdjustment("refund")}
                      isLoading={ledgerActionLoading === "refund"}
                      disabled={paymentSummary.netCollectedAmount <= 0}
                    >
                      Record refund
                    </Button>
                    <Button
                      variant="outline"
                      leftIcon={<Wallet className="h-4 w-4" />}
                      onClick={() => applyLedgerAdjustment("credit")}
                      isLoading={ledgerActionLoading === "credit"}
                      disabled={paymentSummary.outstandingAmount <= 0}
                    >
                      Apply credit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => applyLedgerAdjustment("void")}
                      isLoading={ledgerActionLoading === "void"}
                      disabled={invoice.status === "draft" || !!invoice.voided_at}
                    >
                      Void invoice
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">
                  {paymentSummary.isVoided
                    ? "This invoice has already been voided and removed from active recovery."
                    : "Refund, credit, and void controls stay with finance-capable roles."}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    Stripe linkage
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Capture Stripe invoice and payment intent identifiers as soon as finance has them so webhook matching stops relying on weak fallback inference.
                  </p>
                </div>
                <Badge variant={invoice.stripe_invoice_id || invoice.stripe_payment_intent_id ? "success" : "outline"}>
                  {invoice.stripe_invoice_id || invoice.stripe_payment_intent_id ? "Linked" : "Awaiting link"}
                </Badge>
              </div>
              {canManageLedger ? (
                <div className="mt-4 space-y-3">
                  <Input
                    label="Stripe invoice ID"
                    value={stripeInvoiceIdInput}
                    onChange={(event) => setStripeInvoiceIdInput(event.target.value)}
                    hint={`Billing reference: ${buildInvoiceBillingReference(invoice.org_id, invoice.id, invoice.invoice_number)}`}
                  />
                  <Input
                    label="Stripe payment intent ID"
                    value={stripePaymentIntentIdInput}
                    onChange={(event) => setStripePaymentIntentIdInput(event.target.value)}
                    hint="Add this once Stripe has created a payment attempt so webhook events can attach directly."
                  />
                  <Button
                    variant="outline"
                    onClick={handleStripeLinkSave}
                    isLoading={savingStripeLink}
                  >
                    Save Stripe linkage
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">
                  {isVendorRole(role)
                    ? "Vendor seats can monitor linked status but cannot change Stripe identifiers."
                    : "Your role can review linkage status here while finance keeps Stripe identifiers current."}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Lifecycle controls</CardTitle>
            <CardDescription>
              Advance the invoice through collections and client follow-up.
            </CardDescription>
            <div className="mt-4 space-y-3">
              {transitions.length > 0 ? (
                transitions.map((transition) => (
                  <div
                    key={transition.status}
                    className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {transition.label}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {transition.description}
                        </p>
                      </div>
                      <Badge variant={transition.tone === "danger" ? "danger" : "outline"}>
                        {transition.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No further lifecycle actions are available for this invoice.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-neutral-500" />
              <CardTitle>Recovery guidance</CardTitle>
            </div>
            <CardDescription>
              Role-aware next steps for the current billing and collections posture.
            </CardDescription>
            <div className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-neutral-500">Recommended action</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                      {recoveryGuidance.title}
                    </p>
                  </div>
                  <Badge variant={recoveryGuidance.tone === "default" ? "outline" : recoveryGuidance.tone}>
                    {role ?? "member"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-neutral-500">{recoveryGuidance.detail}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/40">
                {getReminderRecommendation(invoice)}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Outstanding balance</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {fmt(paymentSummary.outstandingAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Sent at</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {invoice.sent_at ? fmtDate(invoice.sent_at) : "Not sent"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>Paid at</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {invoice.paid_at ? fmtDate(invoice.paid_at) : "Not paid"}
                </span>
              </div>
              <div className="rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {getReminderEntryLabel(latestReminder)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {latestReminder
                        ? `${timeAgo(latestReminder.created_at)} by ${latestReminder.profile?.full_name ?? "System"}`
                        : "No follow-up touchpoint has been logged on this invoice yet."}
                    </p>
                  </div>
                  {canUpdateInvoices && canRecordReminder(invoice) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={recordingReminder}
                      leftIcon={<BellRing className="h-4 w-4" />}
                      onClick={handleRecordReminder}
                    >
                      Record reminder
                    </Button>
                  ) : (
                    <Badge variant="outline">
                      {invoice.status === "paid" || invoice.status === "cancelled"
                        ? "Closed"
                        : "Awaiting send"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  Workflow accountability
                </p>
                <div className="mt-3 space-y-2 text-xs text-neutral-500">
                  <div className="flex items-center justify-between gap-3">
                    <span>Workflow owner</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {accountability?.ownerName ?? "Not recorded yet"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Last operator touch</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {accountability?.lastTouchedAt
                        ? `${accountability.lastActorName ?? "System"} · ${timeAgo(accountability.lastTouchedAt)}`
                        : "No workflow touch recorded yet"}
                    </span>
                  </div>
                  <p className="pt-1 text-neutral-400">
                    {canManageBilling
                      ? "Finance-capable roles can route payment recovery from billing while keeping ownership visible here."
                      : canUpdateInvoices
                        ? "Use reminder logging, reconciliation, and lifecycle controls to keep ownership visible as this invoice moves."
                        : isVendorRole(role)
                          ? "Your vendor seat can monitor assigned invoice posture while collections changes stay with internal operators."
                          : "Your role can audit who owns this invoice and when it was last worked, while updates stay with operators."}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {canManageBilling
                    ? "Open billing portal"
                    : canUpdateInvoices
                      ? "Record a payment"
                      : "Monitor payment history"}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {canManageBilling
                    ? "Use the Stripe portal for payment method issues, invoice recovery, and customer billing updates."
                    : canUpdateInvoices
                      ? "Use manual reconciliation above to keep the invoice balance and audit trail current."
                      : role === "viewer"
                        ? "You have read-only oversight access here. Review the timeline and escalate to a finance manager, admin, or owner when action is needed."
                        : "You have read-only access here. Review the timeline and escalate to a manager or admin when action is needed."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {canManageBilling && currentOrg?.stripe_customer_id && (
                    <Button
                      variant="outline"
                      onClick={() => currentOrg && openPortal(currentOrg.id)}
                      isLoading={portalLoading}
                      rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
                    >
                      Open billing portal
                    </Button>
                  )}
                  {canUpdateInvoices && !canManageBilling && canRecordPayment && (
                    <Button onClick={() => setPaymentAmount(String(paymentSummary.outstandingAmount))}>
                      Prefill remaining balance
                    </Button>
                  )}
                  {canUpdateInvoices && invoice.status !== "overdue" && paymentSummary.outstandingAmount > 0 && (
                    <Button variant="outline" onClick={() => handleStatusTransition("overdue")}>
                      Escalate to overdue
                    </Button>
                  )}
                  {canUpdateInvoices && paymentSummary.outstandingAmount > 0 && (
                    <Button variant="ghost" onClick={logRecoveryReview}>
                      Log recovery review
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-neutral-500" />
              <CardTitle>Payment history</CardTitle>
            </div>
            <CardDescription>
              Invoice-level payment and status events that support reconciliation and audit review.
            </CardDescription>
            <div className="mt-4 space-y-3">
              {historyEvents.length > 0 ? (
                historyEvents.map((summary) => (
                  <div
                    key={summary.id}
                    className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{summary.title}</p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {summary.actorName} - {timeAgo(summary.createdAt)}
                        </p>
                      </div>
                      <Badge variant={summary.tone === "default" ? "outline" : summary.tone}>
                        {summary.title}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-neutral-500">{summary.detail}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
                  Payment history will appear here as the invoice moves through send, reconciliation, and recovery actions.
                </div>
              )}
              <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
                Stripe-linked refunds, credits, voids, and manual finance actions now land here together so recovery history stays audit-ready.
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Invoice audit trail</CardTitle>
            <CardDescription>
              Track changes and recipient lifecycle events tied to this invoice.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {activity.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No operational events are recorded for this invoice yet.
                </p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-900 dark:text-white">
                        {getActivityLabel(entry.action)}{" "}
                        <span className="font-medium">{getActivitySubject(entry)}</span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {entry.profile?.full_name ?? "System"} - {timeAgo(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
