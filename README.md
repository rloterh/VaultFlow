# VaultFlow

Enterprise-grade financial dashboard and invoice management platform built with Next.js, Supabase, Stripe, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS 4, Framer Motion
- **State:** Zustand 5 (persisted stores)
- **Database:** Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Payments:** Stripe (Checkout, Customer Portal, Webhooks)
- **PDF:** jsPDF + jspdf-autotable (server-side generation)
- **Charts:** Recharts (area, donut, bar)
- **CI/CD:** GitHub Actions
- **Deploy:** Vercel + Cloudflare
- **Security:** RBAC, JWT, RLS, CSP headers, OWASP practices

## Features

- Multi-tenant organizations with role-based access (owner/admin/manager/member)
- Real-time dashboard with KPI cards, revenue charts, and activity feed
- Invoice CRUD with status lifecycle (draft → sent → viewed → paid → overdue)
- Client management with invoice history and revenue tracking
- PDF invoice generation with professional branded template
- Stripe subscription billing with plan upgrade/downgrade
- Secure webhook handling for payment events
- Admin panel with org overview and member management
- Reports with 12-month trends, status breakdown, and top clients
- Dark mode, responsive design, keyboard shortcuts

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/rloterh/VaultFlow.git
cd VaultFlow
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in Supabase and Stripe keys

# 3. Set up database
# Paste supabase-schema-v1.sql (from PHASE-1-GUIDE.md) in Supabase SQL Editor
# Then paste supabase-schema-v2.sql

# 4. Run
npm run dev
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schemas in order (Phase 1, then Phase 2)
3. Enable Auth providers: Email, Google, GitHub
4. Set redirect URL: `http://localhost:3000/api/auth/callback`
5. After first signup, seed demo data:
   ```sql
   SELECT seed_demo_data('your-org-uuid', 'your-user-uuid');
   ```

## Stripe Setup

1. Create products and prices in [Stripe Dashboard](https://dashboard.stripe.com)
2. Copy price IDs to `.env.local`
3. Set up webhook endpoint: `https://your-domain/api/stripe/webhooks`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. For local development:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhooks
   ```

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Login, signup, forgot password
│   ├── (dashboard)/  # Protected dashboard pages
│   └── api/          # Route handlers (auth, stripe, pdf)
├── components/       # UI components
│   ├── ui/           # Design system primitives
│   ├── charts/       # Recharts wrappers
│   ├── auth/         # Auth forms and guards
│   └── layout/       # Sidebar, header
├── stores/           # Zustand state management
├── hooks/            # Custom React hooks
├── lib/              # Utilities and clients
│   ├── supabase/     # DB clients, queries, realtime
│   ├── stripe/       # Payment integration
│   └── pdf/          # Invoice PDF generation
├── config/           # RBAC roles, navigation, site
└── types/            # TypeScript type definitions
```

## Deployment

### Vercel (recommended)
```bash
vercel deploy
```
Set environment variables in Vercel dashboard.

### Docker
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -t vaultflow .
docker run -p 3000:3000 vaultflow
```

## License

MIT
