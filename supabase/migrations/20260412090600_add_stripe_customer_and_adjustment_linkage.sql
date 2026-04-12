-- ============================================
-- VAULTFLOW DATABASE SCHEMA v5
-- Phase 3: Stripe customer linkage + object-level adjustment idempotency
-- Run AFTER supabase-schema-v4.sql
-- ============================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_customer_id
  ON public.clients(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.invoice_payment_events
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_credit_note_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payment_events_stripe_refund_id
  ON public.invoice_payment_events(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payment_events_stripe_credit_note_id
  ON public.invoice_payment_events(stripe_credit_note_id)
  WHERE stripe_credit_note_id IS NOT NULL;
