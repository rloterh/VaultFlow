"use client";

import { motion } from "framer-motion";
import { CreditCard, Check, ArrowUpRight } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useOrgStore } from "@/stores/org-store";
import { PLANS } from "@/lib/utils/constants";

const planFeatures: Record<string, string[]> = {
  free: ["10 invoices/month", "2 team members", "Basic analytics"],
  pro: ["500 invoices/month", "10 team members", "Advanced analytics", "Priority support"],
  enterprise: ["Unlimited invoices", "Unlimited members", "Custom integrations", "Dedicated CSM"],
};

function BillingContent() {
  const { currentOrg } = useOrgStore();
  const currentPlan = currentOrg?.plan ?? "free";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your subscription and billing details.
        </p>
      </div>

      {/* Current plan */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>
              You&apos;re on the{" "}
              <span className="font-medium text-neutral-900 dark:text-white capitalize">
                {currentPlan}
              </span>{" "}
              plan.
            </CardDescription>
          </div>
          <Badge variant={currentPlan === "free" ? "default" : "success"}>
            {PLANS[currentPlan].name}
          </Badge>
        </div>
        {currentPlan === "free" && (
          <div className="mt-4">
            <Button rightIcon={<ArrowUpRight className="h-4 w-4" />}>
              Upgrade to Pro
            </Button>
          </div>
        )}
      </Card>

      {/* Plan comparison */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((plan) => (
          <Card
            key={plan}
            variant={plan === currentPlan ? "elevated" : "outlined"}
            className={plan === currentPlan ? "ring-2 ring-neutral-900 dark:ring-white" : ""}
          >
            <p className="text-sm font-medium text-neutral-500 capitalize">{plan}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-white">
              ${PLANS[plan].price}
              <span className="text-sm font-normal text-neutral-400">/mo</span>
            </p>
            <ul className="mt-4 space-y-2">
              {planFeatures[plan].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Payment method placeholder */}
      <Card>
        <CardTitle>Payment method</CardTitle>
        <CardDescription>Stripe integration coming in Phase 3.</CardDescription>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-4 dark:border-neutral-800">
          <CreditCard className="h-5 w-5 text-neutral-400" />
          <span className="text-sm text-neutral-500">No payment method on file</span>
        </div>
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
