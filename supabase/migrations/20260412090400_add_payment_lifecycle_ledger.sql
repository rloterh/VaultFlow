-- ============================================
-- VAULTFLOW DATABASE SCHEMA v3
-- Phase 3: Payment lifecycle ledger and recovery groundwork
-- Run AFTER supabase-schema.sql, supabase-schema-v2.sql, and RBAC migrations
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_event_status'
  ) THEN
    CREATE TYPE public.payment_event_status AS ENUM (
      'pending',
      'succeeded',
      'failed',
      'reviewed',
      'refunded',
      'credited',
      'voided'
    );
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_recovery_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credited_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.invoice_payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id),
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  source TEXT NOT NULL DEFAULT 'stripe',
  event_type TEXT NOT NULL,
  status public.payment_event_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoice_payment_events_amount_nonnegative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id
  ON public.invoices(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id
  ON public.invoices(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_events_org
  ON public.invoice_payment_events(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_events_invoice
  ON public.invoice_payment_events(invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_events_stripe_invoice
  ON public.invoice_payment_events(stripe_invoice_id);

ALTER TABLE public.invoice_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view invoice payment events" ON public.invoice_payment_events;
CREATE POLICY "Org members can view invoice payment events"
  ON public.invoice_payment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = invoice_payment_events.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND (
        m.role <> 'vendor'
        OR (
          invoice_payment_events.invoice_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.invoices
            JOIN public.vendor_client_assignments AS a
              ON a.org_id = invoices.org_id
             AND a.client_id = invoices.client_id
            WHERE invoices.id = invoice_payment_events.invoice_id
            AND a.membership_id = m.id
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Operators can manage invoice payment events" ON public.invoice_payment_events;
CREATE POLICY "Operators can manage invoice payment events"
  ON public.invoice_payment_events FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = invoice_payment_events.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND m.role IN ('owner', 'admin', 'manager', 'finance_manager')
    )
  )
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.org_memberships AS m
    WHERE m.org_id = invoice_payment_events.org_id
    AND m.user_id = auth.uid()
    AND m.is_active = TRUE
    AND m.role IN ('owner', 'admin', 'manager', 'finance_manager')
  )
);
