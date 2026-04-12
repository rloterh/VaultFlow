-- ============================================
-- VAULTFLOW VENDOR ASSIGNMENTS
-- Adds assignment-scoped vendor visibility for client and invoice records
-- Run AFTER Phase 1, Phase 2, and supabase-schema-rbac-expansion.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.vendor_client_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.org_memberships(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (membership_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_assignments_org ON public.vendor_client_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assignments_membership ON public.vendor_client_assignments(membership_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assignments_client ON public.vendor_client_assignments(client_id);

ALTER TABLE public.vendor_client_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage vendor client assignments" ON public.vendor_client_assignments;
CREATE POLICY "Admins can manage vendor client assignments"
  ON public.vendor_client_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS m
      WHERE m.org_id = vendor_client_assignments.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
      AND m.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Vendors can view their assignments" ON public.vendor_client_assignments;
CREATE POLICY "Vendors can view their assignments"
  ON public.vendor_client_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS m
      WHERE m.id = vendor_client_assignments.membership_id
      AND m.user_id = auth.uid()
      AND m.role = 'vendor'
      AND m.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Org members can view clients" ON public.clients;
CREATE POLICY "Org members can view clients"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = clients.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND (
        m.role <> 'vendor'
        OR EXISTS (
          SELECT 1
          FROM public.vendor_client_assignments AS a
          WHERE a.org_id = clients.org_id
          AND a.client_id = clients.id
          AND a.membership_id = m.id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Org members can view invoices" ON public.invoices;
CREATE POLICY "Org members can view invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = invoices.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND (
        m.role <> 'vendor'
        OR EXISTS (
          SELECT 1
          FROM public.vendor_client_assignments AS a
          WHERE a.org_id = invoices.org_id
          AND a.client_id = invoices.client_id
          AND a.membership_id = m.id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Invoice item access follows invoice" ON public.invoice_items;
CREATE POLICY "Invoice item access follows invoice"
  ON public.invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices
      JOIN public.org_memberships AS m ON m.org_id = invoices.org_id
      WHERE invoices.id = invoice_items.invoice_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND (
        m.role <> 'vendor'
        OR EXISTS (
          SELECT 1
          FROM public.vendor_client_assignments AS a
          WHERE a.org_id = invoices.org_id
          AND a.client_id = invoices.client_id
          AND a.membership_id = m.id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Org members can view activity" ON public.activity_log;
CREATE POLICY "Org members can view activity"
  ON public.activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = activity_log.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND (
        m.role <> 'vendor'
        OR (
          activity_log.entity_type = 'client'
          AND EXISTS (
            SELECT 1
            FROM public.vendor_client_assignments AS a
            WHERE a.org_id = activity_log.org_id
            AND a.client_id = activity_log.entity_id
            AND a.membership_id = m.id
          )
        )
        OR (
          activity_log.entity_type = 'invoice'
          AND EXISTS (
            SELECT 1
            FROM public.invoices
            JOIN public.vendor_client_assignments AS a
              ON a.org_id = invoices.org_id
             AND a.client_id = invoices.client_id
            WHERE invoices.id = activity_log.entity_id
            AND a.membership_id = m.id
          )
        )
      )
    )
  );

ALTER TABLE public.org_invites
  DROP CONSTRAINT IF EXISTS org_invites_assignable_role;

ALTER TABLE public.org_invites
  ADD CONSTRAINT org_invites_assignable_role
  CHECK (role <> 'owner');
