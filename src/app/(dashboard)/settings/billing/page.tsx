"use client";

import { motion } from "framer-motion";
import { CreditCard, Check, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useOrgStore } from "@/stores/org-store";
import { useStripeCheckout, useStripePortal } from "@/hooks/use-stripe";
import { PLANS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/cn";

const planFeatures: Record<string, string[]> = {
  free: ["10 invoices/month", "2 team members", "Basic analytics", "Email support"],
  pro: ["500 invoices/month", "10 team members", "Advanced analytics", "Priority support", "PDF exports", "Custom branding"],
  enterprise: ["Unlimited invoices", "Unlimited members", "Custom integrations", "Dedicated CSM", "SSO / SAML", "Audit logs"],
};

function BillingContent() {
  const { currentOrg } = useOrgStore();
  const { checkout, isLoading: checkoutLoading } = useStripeCheckout();
  const { openPortal, isLoading: portalLoading } = useStripePortal();
  const currentPlan = currentOrg?.plan ?? "free";
  const hasSubscription = !!currentOrg?.stripe_subscription_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-3xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your subscription and billing details.</p>
      </div>

      {/* Current plan card */}
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

        <div className="mt-4 flex gap-3">
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

      {/* Plan comparison */}
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

      {/* Payment method */}
      <Card>
        <CardTitle>Payment method</CardTitle>
        <CardDescription>
          {hasSubscription
            ? "Manage your payment method through the Stripe portal."
            : "Add a payment method when you upgrade your plan."}
        </CardDescription>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-4 dark:border-neutral-800">
          <CreditCard className="h-5 w-5 text-neutral-400" />
          <span className="text-sm text-neutral-500">
            {hasSubscription
              ? "Payment method on file — click Manage subscription to update"
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
    <AuthGuard minRole="admin">
      <BillingContent />
    </AuthGuard>
  );
}
