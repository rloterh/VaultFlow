-- ============================================
-- VAULTFLOW DATABASE SCHEMA v4
-- Phase 3: Stripe payment event identity + webhook idempotency
-- Run AFTER supabase-schema-v3.sql
-- ============================================

ALTER TABLE public.invoice_payment_events
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payment_events_stripe_event_id
  ON public.invoice_payment_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
