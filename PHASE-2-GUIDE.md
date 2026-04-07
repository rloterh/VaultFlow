# VaultFlow — Phase 2: Dashboard UI, Charts, Data Tables & Real-Time

## Overview
**Duration:** 2 weeks (4 sprints)  
**Goal:** Fully interactive dashboard with Recharts analytics, sortable data tables, invoice/client CRUD, real-time Supabase subscriptions, and SSR/ISR page strategies.

---

## Sprint Breakdown

### Sprint 2.1 — Database Schema v2 + Chart Components (Days 1-3)
- Invoices & clients tables with RLS
- Seed data script for demo
- Recharts wrapper components (area, bar, donut)
- MetricCard component with trend indicators
- Dashboard overview page (live charts + KPIs)

### Sprint 2.2 — Invoice System (Days 4-6)
- Invoice list with DataTable (sort, filter, paginate)
- Invoice detail page with line items
- Create/edit invoice form with validation
- Status workflow (draft → sent → paid → overdue)
- Server actions for CRUD

### Sprint 2.3 — Clients + Real-Time (Days 7-9)
- Client list page with search
- Client detail page with invoice history
- Real-time Supabase subscriptions (invoice status changes)
- Notification feed for live updates
- Empty state components

### Sprint 2.4 — Reports + SSR/ISR Polish (Days 10-14)
- Reports page with date range picker
- Revenue breakdown charts
- SSR for dashboard (fresh data per request)
- ISR for reports (revalidate every 60s)
- Loading skeletons and error boundaries

---

## New Dependencies

```bash
npm install recharts date-fns
```

---

## Database Schema v2 — Run in Supabase SQL Editor

See `supabase-schema-v2.sql` for complete SQL.

---

## Implementation Order

1. `supabase-schema-v2.sql` — New tables + seed data
2. `src/types/database.ts` — Updated types
3. `src/lib/supabase/queries.ts` — Server-side query functions
4. `src/lib/supabase/realtime.ts` — Subscription hooks
5. `src/components/charts/` — All chart components
6. `src/components/ui/data-table.tsx` — Generic data table
7. `src/components/ui/metric-card.tsx` — KPI widget
8. `src/components/ui/empty-state.tsx` — Zero-data states
9. `src/components/ui/date-range-picker.tsx` — Date filtering
10. `src/components/ui/status-badge.tsx` — Invoice status
11. Dashboard overview page (updated)
12. Invoice pages (list, detail, create)
13. Client pages (list, detail)
14. Reports page
