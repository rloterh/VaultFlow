-- ============================================
-- VAULTFLOW DATABASE SCHEMA v2
-- Phase 2: Invoices, Clients, Line Items
-- Run AFTER Phase 1 schema
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.currency AS ENUM ('USD', 'EUR', 'GBP', 'CAD', 'AUD');

-- ============================================
-- CLIENTS TABLE
-- ============================================

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  currency public.currency NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, invoice_number)
);

-- ============================================
-- INVOICE LINE ITEMS
-- ============================================

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOG (for real-time feed)
-- ============================================

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  entity_type TEXT NOT NULL, -- 'invoice', 'client', 'payment'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'sent', 'paid', etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_clients_org ON public.clients(org_id);
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_invoices_org ON public.invoices(org_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX idx_invoices_number ON public.invoices(org_id, invoice_number);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_activity_org ON public.activity_log(org_id, created_at DESC);
CREATE INDEX idx_activity_entity ON public.activity_log(entity_type, entity_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-calculate line item amount
CREATE OR REPLACE FUNCTION public.calc_line_item_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount = NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calc_item_amount
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.calc_line_item_amount();

-- Auto-update invoice totals when line items change
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  inv_id UUID;
  new_subtotal NUMERIC(12,2);
BEGIN
  inv_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO new_subtotal
    FROM public.invoice_items WHERE invoice_id = inv_id;
  UPDATE public.invoices SET
    subtotal = new_subtotal,
    tax_amount = new_subtotal * (tax_rate / 100),
    total = new_subtotal + (new_subtotal * (tax_rate / 100)) - discount_amount
  WHERE id = inv_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recalc_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_totals();

-- Log activity on invoice status change
CREATE OR REPLACE FUNCTION public.log_invoice_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (org_id, user_id, entity_type, entity_id, action, metadata)
    VALUES (
      NEW.org_id,
      NEW.created_by,
      'invoice',
      NEW.id,
      'status_changed',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'invoice_number', NEW.invoice_number,
        'total', NEW.total
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invoice_status_change
  AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_invoice_activity();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Clients: org members can view
CREATE POLICY "Org members can view clients"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = clients.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = TRUE
    )
  );

-- Clients: managers+ can insert/update
CREATE POLICY "Managers can manage clients"
  ON public.clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = clients.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin', 'manager')
      AND org_memberships.is_active = TRUE
    )
  );

-- Invoices: org members can view
CREATE POLICY "Org members can view invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = invoices.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = TRUE
    )
  );

-- Invoices: managers+ can manage
CREATE POLICY "Managers can manage invoices"
  ON public.invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = invoices.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin', 'manager')
      AND org_memberships.is_active = TRUE
    )
  );

-- Invoice items: follow invoice access
CREATE POLICY "Invoice item access follows invoice"
  ON public.invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      JOIN public.org_memberships ON org_memberships.org_id = invoices.org_id
      WHERE invoices.id = invoice_items.invoice_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = TRUE
    )
  );

-- Activity: org members can view
CREATE POLICY "Org members can view activity"
  ON public.activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = activity_log.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = TRUE
    )
  );

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

-- ============================================
-- SEED DATA (for demo purposes)
-- ============================================

-- Note: Replace 'YOUR_ORG_ID' and 'YOUR_USER_ID' with actual UUIDs
-- after creating your first org and user via the app.
-- Or run this function after signup:

CREATE OR REPLACE FUNCTION public.seed_demo_data(p_org_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
  c1_id UUID; c2_id UUID; c3_id UUID; c4_id UUID; c5_id UUID;
  inv_id UUID;
BEGIN
  -- Clients
  INSERT INTO public.clients (id, org_id, name, email, company, city, country, total_revenue, invoice_count)
  VALUES
    (uuid_generate_v4(), p_org_id, 'Sarah Chen', 'sarah@meridianlab.com', 'Meridian Labs', 'San Francisco', 'US', 24500, 5)
    RETURNING id INTO c1_id;
  INSERT INTO public.clients (id, org_id, name, email, company, city, country, total_revenue, invoice_count)
  VALUES
    (uuid_generate_v4(), p_org_id, 'Marcus Webb', 'marcus@novatech.io', 'NovaTech', 'Austin', 'US', 18200, 3)
    RETURNING id INTO c2_id;
  INSERT INTO public.clients (id, org_id, name, email, company, city, country, total_revenue, invoice_count)
  VALUES
    (uuid_generate_v4(), p_org_id, 'Elena Vasquez', 'elena@brightspark.co', 'BrightSpark', 'Miami', 'US', 32100, 7)
    RETURNING id INTO c3_id;
  INSERT INTO public.clients (id, org_id, name, email, company, city, country, total_revenue, invoice_count)
  VALUES
    (uuid_generate_v4(), p_org_id, 'James Okafor', 'james@vectorcraft.dev', 'VectorCraft', 'London', 'GB', 15800, 4)
    RETURNING id INTO c4_id;
  INSERT INTO public.clients (id, org_id, name, email, company, city, country, total_revenue, invoice_count)
  VALUES
    (uuid_generate_v4(), p_org_id, 'Aiko Tanaka', 'aiko@zenpixel.jp', 'ZenPixel', 'Tokyo', 'JP', 41200, 8)
    RETURNING id INTO c5_id;

  -- Invoices (various statuses)
  INSERT INTO public.invoices (org_id, client_id, invoice_number, status, subtotal, tax_rate, tax_amount, total, issue_date, due_date, created_by)
  VALUES
    (p_org_id, c1_id, 'INV-001', 'paid', 4500, 8.5, 382.50, 4882.50, '2025-12-01', '2025-12-31', p_user_id),
    (p_org_id, c1_id, 'INV-002', 'paid', 8200, 8.5, 697, 8897, '2026-01-15', '2026-02-14', p_user_id),
    (p_org_id, c2_id, 'INV-003', 'sent', 6500, 0, 0, 6500, '2026-02-01', '2026-03-03', p_user_id),
    (p_org_id, c3_id, 'INV-004', 'overdue', 12400, 10, 1240, 13640, '2026-01-10', '2026-02-09', p_user_id),
    (p_org_id, c3_id, 'INV-005', 'paid', 7800, 10, 780, 8580, '2026-02-20', '2026-03-22', p_user_id),
    (p_org_id, c4_id, 'INV-006', 'draft', 3200, 20, 640, 3840, '2026-03-01', '2026-03-31', p_user_id),
    (p_org_id, c4_id, 'INV-007', 'sent', 5500, 20, 1100, 6600, '2026-03-10', '2026-04-09', p_user_id),
    (p_org_id, c5_id, 'INV-008', 'paid', 15600, 10, 1560, 17160, '2025-11-15', '2025-12-15', p_user_id),
    (p_org_id, c5_id, 'INV-009', 'viewed', 9800, 10, 980, 10780, '2026-03-05', '2026-04-04', p_user_id),
    (p_org_id, c2_id, 'INV-010', 'draft', 4200, 0, 0, 4200, '2026-03-20', '2026-04-19', p_user_id);

  -- Line items for INV-001
  SELECT id INTO inv_id FROM public.invoices WHERE invoice_number = 'INV-001' AND org_id = p_org_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order)
  VALUES
    (inv_id, 'UI/UX Design — Landing Page', 1, 2500, 2500, 1),
    (inv_id, 'Frontend Development', 1, 2000, 2000, 2);

  -- Line items for INV-004
  SELECT id INTO inv_id FROM public.invoices WHERE invoice_number = 'INV-004' AND org_id = p_org_id;
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order)
  VALUES
    (inv_id, 'Full-Stack App Development', 40, 150, 6000, 1),
    (inv_id, 'Database Architecture', 20, 180, 3600, 2),
    (inv_id, 'DevOps & CI/CD Setup', 1, 2800, 2800, 3);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage after signup: SELECT public.seed_demo_data('your-org-uuid', 'your-user-uuid');
