# VaultFlow Deployment Runbook

## Objective

Ship VaultFlow with predictable runtime configuration, healthy Stripe connectivity, and a verified billing/admin surface after deploy.

## Pre-Deploy Checklist

1. Confirm the target branch has passed:
   - `cmd /c node_modules\.bin\tsc.cmd --noEmit --pretty false -p tsconfig.typecheck.json`
   - `cmd /c npm run build`
2. Confirm all required environment variables are present in the target environment.
3. Confirm Supabase schema is current through `supabase-schema-v5.sql`.
4. Confirm Stripe webhook signing secret matches the deployed environment.

## Required Environment

### Baseline
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`

### Billing
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`

## Supabase Release Steps

1. Link the repo to the intended Supabase project.
2. Apply the tracked SQL in order.
3. Validate:
   - role enum and RLS policies are present
   - `vendor_client_assignments` exists
   - Stripe invoice/payment event tables and columns exist through Phase 3

## Stripe Release Steps

1. Configure the webhook target to:
   - `/api/stripe/webhooks`
2. Ensure the webhook includes the billing events used by VaultFlow:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `refund.created`
   - `credit_note.created`
3. Verify the correct product price IDs are loaded in environment.

## Vercel Rollout

1. Set environment variables for Preview and Production.
2. Deploy the branch.
3. Verify:
   - `/api/health` returns `200`
   - login and workspace selection load
   - billing page loads without missing-config failures
   - admin page renders posture cards and moderation queue

## Docker Rollout

```bash
docker build -t vaultflow .
docker run -p 3000:3000 --env-file .env.local vaultflow
```

Post-start checks:

1. `GET /api/health`
2. load `/dashboard`
3. download an invoice PDF
4. open `/settings/billing`

## Post-Deploy Validation

### Critical
- Health endpoint is green
- Supabase auth works
- Dashboard, invoices, and admin pages render
- Stripe portal and checkout routes respond
- Webhook events can be ingested and recorded

### Finance continuity
- Stripe-linked invoice send stores identifiers
- invoice detail shows payment history
- refund, credit, and void actions remain available to finance-capable roles
- activity log shows governance and billing-control actions

### Governance continuity
- team invites can be created
- role changes write audit events
- vendor assignments still scope visibility correctly
- admin moderation queue reflects live posture

## Rollback Guidance

If the deploy is healthy but billing behavior regresses:

1. stop external traffic to the new deploy
2. validate webhook secret and price IDs first
3. compare schema state versus `supabase-schema-v5.sql`
4. roll back application deploy only after confirming no new migration mismatch was introduced

If schema drift caused the issue, fix schema alignment before re-promoting the app.
