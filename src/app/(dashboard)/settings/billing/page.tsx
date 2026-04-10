"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, ExternalLink, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge, Skeleton } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { PLANS } from "@/lib/utils/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useStripeCheckout, useStripePortal } from "@/hooks/use-stripe";
import { useOrgStore } from "@/stores/org-store";

const planFeatures: Record<string, string[]> = {
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

function formatUsage(
  count: number,
  limit: number
) {
  if (limit < 0) {
    return "Unlimited";
  }

  return `${count}/${limit}`;
}

function BillingContent() {
  const { currentOrg } = useOrgStore();
  const { checkout, isLoading: checkoutLoading } = useStripeCheckout();
  const { openPortal, isLoading: portalLoading } = useStripePortal();
  const currentPlan = currentOrg?.plan ?? "free";
  const hasSubscription = !!currentOrg?.stripe_subscription_id;
  const [usage, setUsage] = useState({
    invoices: 0,
    members: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchUsage() {
      if (!currentOrg) {
        return;
      }

      const sb = getSupabaseBrowserClient();
      const [invoiceRes, memberRes] = await Promise.all([
        sb
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("org_id", currentOrg.id),
        sb
          .from("org_memberships")
          .select("*", { count: "exact", head: true })
          .eq("org_id", currentOrg.id)
          .eq("is_active", true),
      ]);

      setUsage({
        invoices: invoiceRes.count ?? 0,
        members: memberRes.count ?? 0,
        loading: false,
      });
    }

    void fetchUsage();
  }, [currentOrg]);

  const invoiceLimit = PLANS[currentPlan as keyof typeof PLANS]?.invoiceLimit ?? 0;
  const memberLimit = PLANS[currentPlan as keyof typeof PLANS]?.memberLimit ?? 0;

  const usageState = useMemo(() => {
    const invoiceProgress =
      invoiceLimit > 0 ? Math.min((usage.invoices / invoiceLimit) * 100, 100) : 18;
    const memberProgress =
      memberLimit > 0 ? Math.min((usage.members / memberLimit) * 100, 100) : 24;

    return {
      invoiceProgress,
      memberProgress,
    };
  }, [invoiceLimit, memberLimit, usage.invoices, usage.members]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-5xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage plan posture, workspace consumption, and payment administration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-base">Subscription health</CardTitle>
          </div>
          <CardDescription>
            Billing is currently running in a {hasSubscription ? "managed" : "self-serve"} state.
          </CardDescription>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/40">
            <span className="text-sm text-neutral-500">Status</span>
            <Badge variant={hasSubscription ? "success" : "default"}>
              {hasSubscription ? "Active" : "Free tier"}
            </Badge>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">Invoice capacity</CardTitle>
          </div>
          <CardDescription>Monitor current usage against your commercial plan.</CardDescription>
          {usage.loading ? (
            <div className="mt-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Consumption</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {formatUsage(usage.invoices, invoiceLimit)}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                  style={{ width: `${usageState.invoiceProgress}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-base">Seat usage</CardTitle>
          </div>
          <CardDescription>Keep team access within the right governance tier.</CardDescription>
          {usage.loading ? (
            <div className="mt-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Assigned seats</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {formatUsage(usage.members, memberLimit)}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-purple-500 transition-[width] duration-300"
                  style={{ width: `${usageState.memberProgress}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                You&apos;re on the{" "}
                <span className="font-medium capitalize text-neutral-900 dark:text-white">
                  {currentPlan}
                </span>{" "}
                plan.
              </CardDescription>
            </div>
            <Badge variant={currentPlan === "free" ? "default" : "success"}>
              {PLANS[currentPlan as keyof typeof PLANS]?.name ?? "Free"}
            </Badge>
          </div>

          <div className="mt-5 space-y-3">
            {planFeatures[currentPlan].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {feature}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {currentPlan === "free" && (
              <Button
                onClick={() => currentOrg && checkout(currentOrg.id, "pro")}
                isLoading={checkoutLoading}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                Upgrade to Pro
              </Button>
            )}
            {hasSubscription && (
              <Button
                variant="outline"
                onClick={() => currentOrg && openPortal(currentOrg.id)}
                isLoading={portalLoading}
                rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Manage subscription
              </Button>
            )}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((plan) => {
            const isCurrent = plan === currentPlan;
            const isPopular = plan === "pro";

            return (
              <Card
                key={plan}
                variant={isCurrent ? "elevated" : "outlined"}
                className={cn(
                  "relative",
                  isCurrent && "ring-2 ring-neutral-900 dark:ring-white"
                )}
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
                {!isCurrent && plan !== "free" && (
                  <Button
                    variant={isPopular ? "primary" : "outline"}
                    className="mt-5 w-full"
                    size="sm"
                    onClick={() =>
                      currentOrg &&
                      checkout(currentOrg.id, plan as "pro" | "enterprise")
                    }
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
      </div>

      <Card>
        <CardTitle>Payment method</CardTitle>
        <CardDescription>
          {hasSubscription
            ? "Payment details are managed securely through the Stripe customer portal."
            : "A payment method is collected when you upgrade from the free plan."}
        </CardDescription>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-4 dark:border-neutral-800">
          <CreditCard className="h-5 w-5 text-neutral-400" />
          <span className="text-sm text-neutral-500">
            {hasSubscription
              ? "Payment method on file · click Manage subscription to update"
              : "No payment method on file"}
          </span>
        </div>
        {hasSubscription && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => currentOrg && openPortal(currentOrg.id)}
              isLoading={portalLoading}
              rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
            >
              Update payment method
            </Button>
          </div>
        )}
      </Card>
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
