-- ============================================
-- VAULTFLOW DATABASE SCHEMA v1
-- Phase 1: Organizations, profiles, memberships, invites
-- Run BEFORE supabase-schema-v2.sql and any RBAC expansion migrations
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.user_role AS ENUM (
  'owner',
  'admin',
  'finance_manager',
  'manager',
  'member',
  'vendor',
  'viewer'
);

CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired');

-- ============================================
-- ORGANIZATIONS
-- ============================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  plan public.org_plan NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROFILES
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ORG MEMBERSHIPS
-- ============================================

CREATE TABLE public.org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- ============================================
-- ORG INVITES
-- ============================================

CREATE TABLE public.org_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  status public.invite_status NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_invites_assignable_role CHECK (role <> 'owner')
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_memberships_user ON public.org_memberships(user_id);
CREATE INDEX idx_memberships_org ON public.org_memberships(org_id);
CREATE INDEX idx_memberships_role ON public.org_memberships(role);
CREATE INDEX idx_invites_email ON public.org_invites(email);
CREATE INDEX idx_invites_token ON public.org_invites(token);
CREATE INDEX idx_orgs_slug ON public.organizations(slug);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_orgs
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Org members can view org"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships
      WHERE org_memberships.org_id = organizations.id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = TRUE
    )
  );

CREATE POLICY "Admins can update org"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships
      WHERE org_memberships.org_id = organizations.id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin')
      AND org_memberships.is_active = TRUE
    )
  );

CREATE POLICY "Members can view org memberships"
  ON public.org_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = org_memberships.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
    )
  );

CREATE POLICY "Admins can manage memberships"
  ON public.org_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS m
      WHERE m.org_id = org_memberships.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
      AND m.is_active = TRUE
    )
  );

CREATE POLICY "Admins can manage invites"
  ON public.org_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_memberships
      WHERE org_memberships.org_id = org_invites.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin')
      AND org_memberships.is_active = TRUE
    )
  );

CREATE POLICY "Users can view their invites"
  ON public.org_invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
