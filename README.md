# VaultFlow

VaultFlow is a multi-tenant financial operations platform built with Next.js, Supabase, Stripe, Zustand, and Recharts. It is designed as a serious SaaS billing and invoicing product rather than a demo dashboard, with role-aware operations, Stripe-backed billing flows, PDF invoices, audit visibility, and governance tooling.

## Platform Scope

- Multi-tenant workspace model with org-aware access
- Seven-role RBAC posture: `owner`, `admin`, `finance_manager`, `manager`, `member`, `vendor`, `viewer`
- Invoice lifecycle management with collections, recovery, and audit continuity
- Stripe checkout, billing portal, webhook processing, invoice linkage, refund, credit, and void groundwork
- Client operations workspace with reporting and risk surfaces
- Governance and audit surfaces for team access, invite hygiene, vendor scoping, and billing exceptions
- Docker and Vercel deployment support
- Health endpoint at `/api/health`

## Tech Stack

```text
Next.js 15 App Router
React 19
TypeScript 5
Tailwind CSS 4
Supabase (Auth, Postgres, Realtime, RLS)
Stripe
Zustand
Recharts
Framer Motion
jsPDF
```

## Core Areas

### Operations
- Dashboard pulse, revenue trends, queue views, and role-aware variants
- Invoice workspace with reconciliation, recovery review, and payment history
- Client workspace with exposure and collections posture
- Reports surface for finance and operations monitoring

### Billing
- Stripe checkout and billing portal
- Webhook-driven subscription and payment lifecycle updates
- Stripe invoice send/sync flows
- Refund, credit note, and void operator actions with ledger continuity

### Governance
- Admin command surface with moderation queue and posture cards
- Activity log with workflow, billing, and governance filters
- Team lifecycle controls with invite handling and vendor assignment scoping
- Settings guardrails for privileged and destructive actions

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in the required Supabase and Stripe values before running the app.

### 3. Apply schema

The canonical workflow now uses tracked Supabase migrations under [supabase/migrations](c:/Users/HP/OneDrive/Desktop/mp/VaultFlow/supabase/migrations).

Fresh or newly linked environments:

```bash
npm run db:migrations:push
```

Existing environments that were migrated manually should first baseline the tracked migration history, then use `db push` going forward. See [MIGRATION-WORKFLOW.md](c:/Users/HP/OneDrive/Desktop/mp/VaultFlow/doc/MIGRATION-WORKFLOW.md).

### 4. Run locally

```bash
npm run dev
```

### 5. Verify locally

```bash
npm run verify
```

## Environment Variables

See `.env.example` for the full template.

### Required baseline

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=VaultFlow
```

### Required for Stripe billing

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
```

## Health and Runtime Checks

The app exposes:

- `GET /api/health`

This endpoint reports whether the runtime has the required Supabase and Stripe configuration loaded. It returns:

- `200` when the required runtime services are configured
- `503` when configuration is incomplete

## Deployment

### Vercel

1. Add all required environment variables.
2. Configure the Stripe webhook to target `/api/stripe/webhooks`.
3. Run production migrations before promoting traffic.
4. Verify `/api/health` after deployment.

### Docker

```bash
docker build -t vaultflow .
docker run -p 3000:3000 --env-file .env.local vaultflow
```

The container includes a `HEALTHCHECK` against `/api/health`.

## Repo Structure

```text
src/
  app/
    (dashboard)/
    api/
  components/
  config/
  hooks/
  lib/
  stores/
  types/
doc/
  ENTERPRISE-ROADMAP.md
  PHASE-4-GUIDE.md
```

## Additional Notes

- `supabase/.temp` remains local-only, but tracked migrations now live in [supabase/migrations](c:/Users/HP/OneDrive/Desktop/mp/VaultFlow/supabase/migrations).
- Vendor access is assignment-scoped through `vendor_client_assignments`.
- Governance and billing lifecycle helpers are concentrated under `src/lib/`.
