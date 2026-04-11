"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookmarkPlus,
  CalendarClock,
  Check,
  CreditCard,
  ExternalLink,
  Pencil,
  Receipt,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { buildBillingRecoveryBriefing } from "@/lib/billing/recovery-briefing";
import { useStripeCheckout, useStripePortal } from "@/hooks/use-stripe";
import { buildBillingWorkspaceSummary } from "@/lib/billing/intelligence";
import { buildInvoiceIntentHref } from "@/lib/invoices/history";
import {
  filterPaymentRecoveryQueue,
  getPaymentRecoveryQueue,
  type PaymentRecoveryPreset,
} from "@/lib/invoices/payments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { PLANS } from "@/lib/utils/constants";
import { useOrgStore } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import type { OrgPlan } from "@/types/auth";
import type { ActivityEntry, Invoice } from "@/types/database";

const planFeatures: Record<OrgPlan, string[]> = {
  free: ["10 invoices/month", "2 team members", "Basic analytics", "Email support"],
  pro: [
    "500 invoices/month",
    "10 team members",
    "Advanced analytics",
    "Priority support",
    "PDF exports",
    "Custom branding",
  ],
  enterprise: [
    "Unlimited invoices",
    "Unlimited members",
    "Custom integrations",
    "Dedicated CSM",
    "SSO / SAML",
    "Audit logs",
  ],
};

const healthIcons = [ShieldCheck, CreditCard, CalendarClock, TrendingUp] as const;
const RECOVERY_PRESETS: Array<{ value: PaymentRecoveryPreset; label: string }> = [
  { value: "priority", label: "Priority recovery" },
  { value: "overdue", label: "Overdue only" },
  { value: "partial", label: "Partial collections" },
  { value: "open", label: "Open balances" },
];

function formatUsage(count: number, limit: number) {
  if (limit < 0) {
    return "Unlimited";
  }

  return `${count}/${limit}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(dateStr: string) {
  const then = new Date(dateStr).getTime();
  const diff = Math.max(Date.now() - then, 0);
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function toneBadgeVariant(tone: "default" | "success" | "warning" | "danger" | "info") {
  return tone === "default" ? "outline" : tone;
}

function toneShellClasses(tone: "default" | "success" | "warning" | "danger" | "info") {
  return {
    default: "border-neutral-200 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/60",
    success: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    warning: "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
    danger: "border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20",
    info: "border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20",
  }[tone];
}

type BillingFetchState = {
  invoiceCount: number;
  memberCount: number;
  invoices: Array<
    Pick<
      Invoice,
      | "id"
      | "invoice_number"
      | "status"
      | "total"
      | "amount_paid"
      | "due_date"
      | "credited_amount"
      | "refunded_amount"
      | "voided_at"
    > & {
      client?: { name?: string | null };
    }
  >;
  events: ActivityEntry[];
  loading: boolean;
  error: string | null;
};

function BillingContent() {
  const { currentOrg } = useOrgStore();
  const { can, role } = usePermissions();
  const { checkout, isLoading: checkoutLoading } = useStripeCheckout();
  const { openPortal, isLoading: portalLoading } = useStripePortal();
  const addToast = useUIStore((state) => state.addToast);
  const savedBillingRecoveryPresets = useUIStore(
    (state) => state.savedBillingRecoveryPresets
  );
  const saveBillingRecoveryPreset = useUIStore(
    (state) => state.saveBillingRecoveryPreset
  );
  const updateBillingRecoveryPresetLabel = useUIStore(
    (state) => state.updateBillingRecoveryPresetLabel
  );
  const removeBillingRecoveryPreset = useUIStore(
    (state) => state.removeBillingRecoveryPreset
  );
  const currentPlan = (currentOrg?.plan ?? "free") as OrgPlan;
  const hasSubscription = !!currentOrg?.stripe_subscription_id;
  const [billingState, setBillingState] = useState<BillingFetchState>({
    invoiceCount: 0,
    memberCount: 0,
    invoices: [],
    events: [],
    loading: true,
    error: null,
  });
  const [recoveryPreset, setRecoveryPreset] =
    useState<PaymentRecoveryPreset>("priority");
  const [presetName, setPresetName] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetLabel, setEditingPresetLabel] = useState("");

  useEffect(() => {
    let isActive = true;

    async function fetchBillingState() {
      if (!currentOrg) {
        if (isActive) {
          setBillingState((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      const sb = getSupabaseBrowserClient();

      const [invoiceRes, memberRes, eventRes] = await Promise.all([
        sb
          .from("invoices")
          .select("id, invoice_number, status, total, amount_paid, due_date, credited_amount, refunded_amount, voided_at, client:clients(name)")
          .eq("org_id", currentOrg.id),
        sb
          .from("org_memberships")
          .select("*", { count: "exact", head: true })
          .eq("org_id", currentOrg.id)
          .eq("is_active", true),
        sb
          .from("activity_log")
          .select("id, org_id, user_id, entity_type, entity_id, action, metadata, created_at")
          .eq("org_id", currentOrg.id)
          .eq("entity_type", "billing")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!isActive) {
        return;
      }

      if (invoiceRes.error || memberRes.error || eventRes.error) {
        setBillingState({
          invoiceCount: 0,
          memberCount: 0,
          invoices: [],
          events: [],
          loading: false,
          error: "Unable to load billing telemetry right now.",
        });
        return;
      }

      const invoices = (invoiceRes.data ?? []) as Array<
        Pick<
          Invoice,
          | "id"
          | "invoice_number"
          | "status"
          | "total"
          | "amount_paid"
          | "due_date"
          | "credited_amount"
          | "refunded_amount"
          | "voided_at"
        > & {
          client?: { name?: string | null };
        }
      >;
      const events = (eventRes.data ?? []) as ActivityEntry[];

      setBillingState({
        invoiceCount: invoices.length,
        memberCount: memberRes.count ?? 0,
        invoices,
        events,
        loading: false,
        error: null,
      });
    }

    void fetchBillingState();

    return () => {
      isActive = false;
    };
  }, [currentOrg]);

  const invoiceLimit = PLANS[currentPlan].invoiceLimit;
  const memberLimit = PLANS[currentPlan].memberLimit;

  const workspaceSummary = useMemo(
    () =>
      buildBillingWorkspaceSummary({
        plan: currentPlan,
        hasSubscription,
        invoiceCount: billingState.invoiceCount,
        memberCount: billingState.memberCount,
        invoiceLimit,
        memberLimit,
        invoices: billingState.invoices,
        events: billingState.events,
      }),
    [
      billingState.events,
      billingState.invoiceCount,
      billingState.invoices,
      billingState.memberCount,
      currentPlan,
      hasSubscription,
      invoiceLimit,
      memberLimit,
    ]
  );
  const recoveryQueue = useMemo(
    () => getPaymentRecoveryQueue(billingState.invoices, 12),
    [billingState.invoices]
  );
  const visibleRecoveryQueue = useMemo(
    () => filterPaymentRecoveryQueue(recoveryQueue, recoveryPreset).slice(0, 5),
    [recoveryPreset, recoveryQueue]
  );
  const customRecoveryPresets = useMemo(
    () =>
      savedBillingRecoveryPresets.filter(
        (preset) => preset.orgId === currentOrg?.id
      ),
    [currentOrg?.id, savedBillingRecoveryPresets]
  );
  const activeRecoveryPreset = useMemo(
    () =>
      customRecoveryPresets.find((preset) => preset.preset === recoveryPreset) ?? null,
    [customRecoveryPresets, recoveryPreset]
  );
  const canManageBilling = can("org:billing");
  const canRecoverInvoices = can("invoices:update");
  const recoveryActionLabel = canManageBilling
    ? "Manage in Stripe"
    : canRecoverInvoices
      ? "Reconcile invoice"
      : "Review balance";
  const recoveryIntent = canRecoverInvoices ? "record-payment" : "history";
  const primaryInsight = workspaceSummary.insights[0];
  const recoveryBriefing = useMemo(
    () =>
      buildBillingRecoveryBriefing({
        label:
          activeRecoveryPreset?.label ??
          RECOVERY_PRESETS.find((entry) => entry.value === recoveryPreset)?.label ??
          "Recovery workspace",
        preset: recoveryPreset,
        items: visibleRecoveryQueue,
      }),
    [activeRecoveryPreset?.label, recoveryPreset, visibleRecoveryQueue]
  );

  function saveCurrentRecoveryPreset() {
    if (!currentOrg) {
      return;
    }

    const trimmedLabel = presetName.trim();
    if (!trimmedLabel) {
      addToast({
        type: "warning",
        title: "Name this billing preset",
        description: "Add a short label so finance operators can reopen it later.",
      });
      return;
    }

    const duplicate = customRecoveryPresets.find(
      (preset) =>
        preset.preset === recoveryPreset &&
        preset.label.toLowerCase() === trimmedLabel.toLowerCase()
    );

    if (duplicate) {
      addToast({
        type: "info",
        title: "Billing preset already exists",
        description: "This recovery slice is already saved for the current workspace.",
      });
      return;
    }

    saveBillingRecoveryPreset({
      orgId: currentOrg.id,
      label: trimmedLabel,
      preset: recoveryPreset,
    });
    setPresetName("");
    addToast({
      type: "success",
      title: "Billing preset saved",
      description: `${trimmedLabel} is now available in the finance workspace.`,
    });
  }

  function startEditingPreset(id: string, label: string) {
    setEditingPresetId(id);
    setEditingPresetLabel(label);
  }

  function cancelEditingPreset() {
    setEditingPresetId(null);
    setEditingPresetLabel("");
  }

  function renameRecoveryPreset(id: string) {
    const trimmedLabel = editingPresetLabel.trim();
    const currentPreset = customRecoveryPresets.find((preset) => preset.id === id);

    if (!currentPreset) {
      cancelEditingPreset();
      return;
    }

    if (!trimmedLabel) {
      addToast({
        type: "warning",
        title: "Name required",
        description: "Saved billing presets need a short label.",
      });
      return;
    }

    if (trimmedLabel === currentPreset.label) {
      cancelEditingPreset();
      return;
    }

    const duplicateLabel = customRecoveryPresets.find(
      (preset) =>
        preset.id !== id &&
        preset.label.toLowerCase() === trimmedLabel.toLowerCase()
    );

    if (duplicateLabel) {
      addToast({
        type: "warning",
        title: "Label already used",
        description: "Choose a distinct billing preset label for operators.",
      });
      return;
    }

    updateBillingRecoveryPresetLabel(id, trimmedLabel);
    addToast({
      type: "success",
      title: "Billing preset renamed",
      description: `${currentPreset.label} is now ${trimmedLabel}.`,
    });
    cancelEditingPreset();
  }

  function deleteRecoveryPreset(id: string, label: string) {
    removeBillingRecoveryPreset(id);
    addToast({
      type: "info",
      title: "Billing preset removed",
      description: `${label} has been removed from this workspace.`,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl space-y-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Billing</h1>
            <Badge variant={currentPlan === "free" ? "outline" : "success"}>
              {PLANS[currentPlan].name}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {role === "finance_manager"
              ? "Run recovery, subscription posture, and cash-collection administration without broader workspace governance."
              : "Run subscription governance, capacity planning, and payment recovery from one finance-ready workspace."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {currentPlan === "free" && currentOrg && (
            <Button
              onClick={() => checkout(currentOrg.id, "pro")}
              isLoading={checkoutLoading}
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Upgrade to Pro
            </Button>
          )}
          {hasSubscription && currentOrg && (
            <Button
              variant="outline"
              onClick={() => openPortal(currentOrg.id)}
              isLoading={portalLoading}
              rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
            >
              Open billing portal
            </Button>
          )}
        </div>
      </div>

      {billingState.error && (
        <Card className="border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div>
              <CardTitle className="text-base">Billing telemetry degraded</CardTitle>
              <CardDescription className="mt-1">
                {billingState.error} Stripe checkout and portal actions are still available.
              </CardDescription>
            </div>
          </div>
        </Card>
      )}

      {primaryInsight && (
        <Card className={cn("border", toneShellClasses(primaryInsight.tone))}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={toneBadgeVariant(primaryInsight.tone)}>{primaryInsight.title}</Badge>
              </div>
              <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                {primaryInsight.description}
              </p>
            </div>
            {hasSubscription && currentOrg ? (
              <Button
                variant="outline"
                onClick={() => openPortal(currentOrg.id)}
                isLoading={portalLoading}
                rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Resolve in Stripe
              </Button>
            ) : (
              <span className="text-xs text-neutral-500">
                Upgrade to unlock managed billing controls and payment recovery tooling.
              </span>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workspaceSummary.healthCards.map((card, index) => {
          const Icon = healthIcons[index] ?? ShieldCheck;

          return (
            <Card key={card.label}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-neutral-500" />
                <CardTitle className="text-base">{card.label}</CardTitle>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-neutral-900 dark:text-white">{card.value}</p>
                <Badge variant={toneBadgeVariant(card.tone)}>{card.value}</Badge>
              </div>
              <CardDescription className="mt-3">{card.detail}</CardDescription>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Capacity and commercial fit</CardTitle>
              <CardDescription>
                Monitor invoice throughput and seat usage before they turn into billing friction.
              </CardDescription>
            </div>
            <Badge variant="outline">{PLANS[currentPlan].name}</Badge>
          </div>

          {billingState.loading ? (
            <div className="mt-6 space-y-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {[
                {
                  label: "Invoice volume",
                  accent: "bg-blue-500",
                  metric: workspaceSummary.invoiceUsage,
                  usageText: formatUsage(billingState.invoiceCount, invoiceLimit),
                },
                {
                  label: "Seat usage",
                  accent: "bg-purple-500",
                  metric: workspaceSummary.seatUsage,
                  usageText: formatUsage(billingState.memberCount, memberLimit),
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{item.label}</p>
                      <p className="mt-1 text-neutral-500">{item.metric.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-neutral-900 dark:text-white">{item.usageText}</p>
                      <Badge variant={toneBadgeVariant(item.metric.tone)} className="mt-1">
                        {item.metric.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-300", item.accent)}
                      style={{ width: `${item.metric.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {workspaceSummary.insights.map((insight) => (
              <div
                key={insight.title}
                className={cn("rounded-xl border p-4", toneShellClasses(insight.tone))}
              >
                <Badge variant={toneBadgeVariant(insight.tone)}>{insight.title}</Badge>
                <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                  {insight.description}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                Align plan posture with billing complexity, workspace size, and reporting depth.
              </CardDescription>
            </div>
            <Badge variant={currentPlan === "free" ? "outline" : "success"}>
              {PLANS[currentPlan].name}
            </Badge>
          </div>

          <div className="mt-5 space-y-3">
            {planFeatures[currentPlan].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {feature}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">Commercial controls</p>
            <p className="mt-1 text-sm text-neutral-500">
              {hasSubscription
                ? role === "finance_manager"
                  ? "Use the Stripe portal for payment method changes, billing history, and recovery work without opening people-admin surfaces."
                  : "Use the Stripe portal for payment method changes, billing history, and subscription adjustments."
                : "Free workspaces can upgrade instantly once you are ready for managed billing and higher capacity."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {currentPlan === "free" && currentOrg && (
                <Button
                  size="sm"
                  onClick={() => checkout(currentOrg.id, "pro")}
                  isLoading={checkoutLoading}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  Start paid billing
                </Button>
              )}
              {hasSubscription && currentOrg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPortal(currentOrg.id)}
                  isLoading={portalLoading}
                  rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
                >
                  Manage in Stripe
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workspaceSummary.collectionMetrics.map((metric) => (
          <Card key={metric.label}>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-neutral-500" />
              <CardTitle className="text-base">{metric.label}</CardTitle>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">{metric.value}</p>
              <Badge variant={toneBadgeVariant(metric.tone)}>{metric.value}</Badge>
            </div>
            <CardDescription className="mt-3">{metric.detail}</CardDescription>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Payment recovery queue</CardTitle>
            <CardDescription>
              Route operators into the invoices carrying residual balance, partial collection, or overdue pressure first.
            </CardDescription>
          </div>
          <Link
            href="/dashboard/invoices"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            {canManageBilling
              ? "Open recovery workspace"
              : canRecoverInvoices
                ? "Open reconciliation workspace"
                : "Review invoice balances"}
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200/70 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    recoveryBriefing.tone === "danger"
                      ? "danger"
                      : recoveryBriefing.tone === "warning"
                        ? "warning"
                        : recoveryBriefing.tone === "success"
                          ? "success"
                          : "info"
                  }
                >
                  Recovery briefing
                </Badge>
                <Badge variant="outline">
                  {activeRecoveryPreset?.label ??
                    RECOVERY_PRESETS.find((entry) => entry.value === recoveryPreset)?.label}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
                {recoveryBriefing.title}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {recoveryBriefing.detail}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Collections handoff"
                className="sm:w-64"
              />
              <Button
                type="button"
                variant="outline"
                leftIcon={<BookmarkPlus className="h-4 w-4" />}
                onClick={saveCurrentRecoveryPreset}
              >
                Save preset
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {RECOVERY_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setRecoveryPreset(preset.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  recoveryPreset === preset.value
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {recoveryBriefing.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-neutral-200/70 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/40"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  {stat.label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-white">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-neutral-500">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-neutral-200 px-4 py-4 dark:border-neutral-800">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              Finance next moves
            </p>
            <div className="mt-3 space-y-2">
              {recoveryBriefing.recommendations.map((entry) => (
                <p key={entry} className="text-sm text-neutral-500">
                  {entry}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {customRecoveryPresets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500 dark:border-neutral-800 xl:col-span-3">
                No saved billing presets yet. Capture the recovery slices your finance team reopens most often.
              </div>
            ) : (
              customRecoveryPresets.map((preset) => {
                const isActive = activeRecoveryPreset?.id === preset.id;
                const isEditing = editingPresetId === preset.id;

                return (
                  <div
                    key={preset.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isActive
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-200/70 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Input
                              value={editingPresetLabel}
                              onChange={(event) => setEditingPresetLabel(event.target.value)}
                              className="h-9"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={isActive ? "secondary" : "outline"}
                                leftIcon={<Save className="h-3.5 w-3.5" />}
                                onClick={() => renameRecoveryPreset(preset.id)}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                leftIcon={<X className="h-3.5 w-3.5" />}
                                onClick={cancelEditingPreset}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRecoveryPreset(preset.preset)}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate text-sm font-semibold">{preset.label}</p>
                            <p
                              className={`mt-2 text-xs ${
                                isActive
                                  ? "text-neutral-200 dark:text-neutral-600"
                                  : "text-neutral-500 dark:text-neutral-400"
                              }`}
                            >
                              {RECOVERY_PRESETS.find((entry) => entry.value === preset.preset)?.label}
                            </p>
                          </button>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditingPreset(preset.id, preset.label)}
                            className={`rounded-lg p-2 transition-colors ${
                              isActive
                                ? "text-white/75 hover:bg-white/10 hover:text-white dark:text-neutral-700 dark:hover:bg-neutral-900/10 dark:hover:text-neutral-900"
                                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                            }`}
                            aria-label={`Rename ${preset.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecoveryPreset(preset.id, preset.label)}
                            className={`rounded-lg p-2 transition-colors ${
                              isActive
                                ? "text-white/75 hover:bg-white/10 hover:text-white dark:text-neutral-700 dark:hover:bg-neutral-900/10 dark:hover:text-neutral-900"
                                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                            }`}
                            aria-label={`Delete ${preset.label}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {visibleRecoveryQueue.length > 0 ? (
          <div className="mt-6 grid gap-3 lg:grid-cols-5">
            {visibleRecoveryQueue.map((item) => (
              <Link
                key={item.id}
                href={buildInvoiceIntentHref(item.id, recoveryIntent)}
                className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 transition-colors hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    {item.invoiceNumber}
                  </p>
                  <Badge variant={item.isPartial ? "info" : item.status === "overdue" ? "danger" : "warning"}>
                    {item.isPartial ? "Partial" : item.status === "overdue" ? "Overdue" : "Open"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-neutral-500">{item.clientName}</p>
                <p className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
                  {fmt(item.outstandingAmount)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {fmt(item.collectedAmount)} collected so far | due {fmtDate(item.dueDate)}
                </p>
                <p className="mt-2 text-xs font-medium text-neutral-500">{recoveryActionLabel}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
            No invoices currently need payment recovery attention.
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {(Object.keys(PLANS) as OrgPlan[]).map((plan) => {
          const isCurrent = plan === currentPlan;
          const isPopular = plan === "pro";

          return (
            <Card
              key={plan}
              variant={isCurrent ? "elevated" : "outlined"}
              className={cn("relative", isCurrent && "ring-2 ring-neutral-900 dark:ring-white")}
            >
              {isPopular && !isCurrent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
                    Most popular
                  </span>
                </div>
              )}
              <p className="text-sm font-medium capitalize text-neutral-500">{plan}</p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-white">
                ${PLANS[plan].price}
                <span className="text-sm font-normal text-neutral-400">/mo</span>
              </p>
              <ul className="mt-5 space-y-2.5">
                {planFeatures[plan].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan !== "free" && currentOrg && (
                <Button
                  variant={isPopular ? "primary" : "outline"}
                  className="mt-5 w-full"
                  size="sm"
                  onClick={() => checkout(currentOrg.id, plan)}
                  isLoading={checkoutLoading}
                >
                  {currentPlan === "free" ? "Upgrade" : "Switch"} to {plan}
                </Button>
              )}
              {isCurrent && (
                <div className="mt-5 flex items-center justify-center rounded-lg bg-neutral-50 py-2 text-xs font-medium text-neutral-500 dark:bg-neutral-800">
                  Current plan
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Recent billing events</CardTitle>
              <CardDescription>
                Follow Stripe-driven plan changes, successful collections, and payment recovery signals.
              </CardDescription>
            </div>
            <Receipt className="h-4 w-4 text-neutral-400" />
          </div>

          {billingState.loading ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : workspaceSummary.timeline.length > 0 ? (
            <div className="mt-6 space-y-3">
              {workspaceSummary.timeline.map((item) => (
                <div
                  key={item.id}
                  className={cn("rounded-xl border p-4", toneShellClasses(item.tone))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.title}</p>
                        <Badge variant={toneBadgeVariant(item.tone)}>{formatRelativeTime(item.createdAt)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
              Billing activity will appear here after upgrades, Stripe renewals, or payment events start flowing through the workspace.
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Payment method and controls</CardTitle>
          <CardDescription>
            Keep payment updates, billing history, and invoice recovery inside the Stripe customer portal.
          </CardDescription>
          <div className="mt-5 rounded-xl border border-dashed border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {hasSubscription ? "Managed payment profile" : "No payment method on file"}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {hasSubscription
                    ? "Payment details are stored securely in Stripe. Use the portal for updates, invoices, and subscription changes."
                    : "A payment method is collected automatically when this workspace upgrades to a paid plan."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Finance operator note</p>
              <p className="mt-1 text-sm text-neutral-500">
                {role === "finance_manager"
                  ? "Route failed payments and subscription updates through the portal first, then confirm new events land in the billing timeline above."
                  : "Use the portal for billing-safe actions, then verify that payment and subscription events show up in the timeline above."}
              </p>
            </div>
            {hasSubscription && currentOrg ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openPortal(currentOrg.id)}
                isLoading={portalLoading}
                rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Update payment method
              </Button>
            ) : currentOrg ? (
              <Button
                className="w-full"
                onClick={() => checkout(currentOrg.id, "pro")}
                isLoading={checkoutLoading}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                Upgrade to activate payments
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

export default function BillingPage() {
  return (
    <AuthGuard permission="org:billing">
      <BillingContent />
    </AuthGuard>
  );
}
