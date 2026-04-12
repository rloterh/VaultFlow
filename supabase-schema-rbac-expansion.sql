-- ============================================
-- VAULTFLOW RBAC EXPANSION
-- Adds finance_manager, vendor, and viewer
-- Run AFTER the Phase 1 org/auth schema and before relying on the new roles in-app
-- ============================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendor';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'finance_manager';

DROP POLICY IF EXISTS "Managers can manage clients" ON public.clients;
CREATE POLICY "Managers can manage clients"
  ON public.clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = clients.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin', 'manager', 'finance_manager')
      AND org_memberships.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Managers can manage invoices" ON public.invoices;
CREATE POLICY "Managers can manage invoices"
  ON public.invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = invoices.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin', 'manager', 'finance_manager')
      AND org_memberships.is_active = TRUE
    )
  );

-- owner/admin remain the only roles with invite and org-governance authority.
-- vendor and viewer continue to rely on membership-level SELECT visibility until a
-- dedicated assignment-scoped external access model is added.
