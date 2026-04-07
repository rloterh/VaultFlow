# VaultFlow — Phase 3: Stripe, PDF Invoices, Webhooks & Admin Polish

## Overview
**Duration:** 2 weeks (4 sprints)  
**Goal:** Stripe subscription billing, PDF invoice generation, secure webhook handling, admin panel, and production polish.

---

## Sprint Breakdown

### Sprint 3.1 — Stripe Setup & Subscription Flow (Days 1-3)
- Stripe SDK integration
- Checkout session creation (subscribe to plan)
- Customer portal link (manage subscription)
- Pricing page with plan comparison
- Webhook endpoint for subscription events

### Sprint 3.2 — PDF Invoice Generation (Days 4-6)
- Server-side PDF generation with jsPDF
- Invoice template with branding, line items, totals
- Download endpoint (API route)
- Email-ready PDF attachment support
- Invoice preview component

### Sprint 3.3 — Webhook System & Email (Days 7-9)
- Secure Stripe webhook verification
- Handle: checkout.completed, subscription.updated/deleted, invoice.paid
- Org plan auto-upgrade/downgrade on subscription change
- Activity log integration for billing events
- Email notification stubs (Resend-ready)

### Sprint 3.4 — Admin Panel & Production Polish (Days 10-14)
- Super admin dashboard (all orgs, all users)
- Org management (view, suspend, change plan)
- Error boundary component
- Loading skeleton system
- Performance: code splitting, image optimization
- Security headers audit
- Final Vercel deploy configuration

---

## New Dependencies

```bash
npm install stripe @stripe/stripe-js jspdf jspdf-autotable
npm install -D @types/jspdf
```

---

## Environment Variables (add to .env.local)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```
