# VaultFlow — SaaS Financial Dashboard & Invoice Platform

A production-grade, multi-tenant SaaS financial dashboard built with Next.js, Supabase, Stripe, and Recharts. Features RBAC, real-time analytics, PDF invoice generation, subscription billing, and a full admin panel.

## Features

- **Multi-tenant RBAC** — 4-role hierarchy (owner/admin/manager/member) with 18 granular permissions
- **Real-time dashboard** — Revenue area chart, invoice status donut, metric cards with live Supabase subscriptions
- **Invoice management** — Full CRUD with status lifecycle (draft → sent → viewed → paid → overdue), line items, and auto-total calculation
- **PDF generation** — Branded A4 invoices with jsPDF, downloadable via API route
- **Client management** — Directory with contact info, invoice history, and revenue tracking
- **Stripe subscriptions** — Checkout sessions, customer portal, webhook lifecycle management
- **Reports** — 12-month revenue trends, top clients bar chart, exportable analytics
- **Admin panel** — Organization overview, member management with role changes
- **Activity log** — Audit trail of all org actions with relative timestamps
- **Settings** — Profile editing, org configuration, notification preferences, danger zone
- **SEO** — JSON-LD structured data, dynamic sitemap, robots.txt, OG image generation

## Tech Stack

```
Next.js 16        React 19           TypeScript 5.7+
Tailwind CSS 4    Zustand 5          Supabase (Auth + DB + Realtime + RLS)
Stripe            Recharts           jsPDF
Framer Motion     Lucide React
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup, forgot-password
│   ├── (dashboard)/
│   │   ├── dashboard/       # Overview, invoices, clients, reports, activity, admin
│   │   └── settings/        # General, team, billing
│   ├── api/
│   │   ├── auth/callback/   # Supabase OAuth callback
│   │   ├── invoices/[id]/pdf/ # PDF download endpoint
│   │   ├── stripe/          # Checkout, portal, webhooks
│   │   └── og/              # Dynamic OG image generation
│   ├── sitemap.ts           # XML sitemap
│   └── robots.ts            # Crawler directives
├── components/
│   ├── ui/                  # Button, Input, Card, Badge, DataTable, Toast, etc.
│   ├── charts/              # RevenueChart, StatusChart (Recharts)
│   ├── layout/              # Sidebar (collapsible), Header
│   ├── auth/                # LoginForm, SignupForm, OAuthButtons, AuthGuard
│   └── providers/           # SupabaseProvider
├── stores/                  # Zustand: auth, org, ui (with persist)
├── hooks/                   # useAuth, usePermissions, useStripe
├── lib/
│   ├── supabase/            # Client, server, middleware, queries, realtime
│   ├── stripe/              # Server client, browser helpers
│   ├── pdf/                 # jsPDF invoice generator
│   ├── seo/                 # Structured data, metadata helpers
│   └── utils/               # cn, constants
├── config/                  # Navigation (RBAC-filtered), roles, site
└── types/                   # Auth, database types
```

## Database Schema

3 SQL files across 4 phases:

| File | Tables | Features |
|------|--------|----------|
| `supabase-schema.sql` | organizations, profiles, org_memberships, org_invites | RBAC, auto-profile trigger, RLS |
| `supabase-schema-v2.sql` | invoices, clients, line_items, activity_log | Auto-totals trigger, activity logging |
| *(inline Phase 3)* | Stripe fields on organizations | subscription_id, customer_id |

## Quick Start

```bash
# 1. Create project
npx create-next-app@latest vaultflow --typescript --tailwind --eslint --app --src-dir

# 2. Install dependencies
npm install zustand @supabase/supabase-js @supabase/ssr framer-motion \
  clsx tailwind-merge lucide-react recharts jspdf stripe @stripe/stripe-js

# 3. Setup environment
cp .env.example .env.local
# Fill in Supabase + Stripe keys

# 4. Database
# Paste supabase-schema.sql then supabase-schema-v2.sql into Supabase SQL Editor

# 5. Stripe webhook
# Point to /api/stripe/webhooks with events:
# checkout.session.completed, customer.subscription.updated,
# customer.subscription.deleted, invoice.paid, invoice.payment_failed

# 6. Run
npm run dev
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=VaultFlow
```

## RBAC Permission Matrix

| Permission | Owner | Admin | Manager | Member |
|-----------|-------|-------|---------|--------|
| org:update/delete/billing | ✓/✓/✓ | ✓/✗/✓ | ✗ | ✗ |
| members:invite/remove/role | ✓ | ✓ | ✗ | ✗ |
| invoices:create/update/delete/send | ✓ | ✓ | ✓(no delete) | read-only |
| clients:create/update/delete | ✓ | ✓ | ✓(no delete) | read-only |
| reports:read/export | ✓ | ✓ | read | read |
| settings:read/update | ✓ | ✓ | read | read |

## Deployment

```bash
# Vercel (recommended)
vercel deploy

# Docker
docker build -t vaultflow .
docker run -p 3000:3000 vaultflow
```

## License

MIT
