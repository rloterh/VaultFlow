# VaultFlow — Phase 1: Foundation & Auth System

## Overview
**Duration:** 2 weeks (4 sprints)  
**Goal:** Fully authenticated multi-tenant SaaS scaffold with RBAC, Supabase integration, Zustand state management, CI/CD pipeline, and enterprise-grade project architecture.

---

## Sprint Breakdown

### Sprint 1.1 — Project Scaffold & Design System (Days 1-2)
- Next.js 16 + TypeScript + Tailwind CSS 4 setup
- Folder architecture (feature-based modular)
- Design system tokens, base components
- ESLint + Prettier + Husky config

### Sprint 1.2 — Supabase Schema & Auth (Days 3-5)
- Supabase project setup
- Database schema (orgs, profiles, memberships)
- Supabase Auth (email/password + OAuth)
- Row Level Security (RLS) policies

### Sprint 1.3 — RBAC & Zustand Stores (Days 6-8)
- Role-based access control (admin, manager, member)
- Next.js middleware for route protection
- Zustand stores (auth, ui, org)
- Server-side session validation

### Sprint 1.4 — CI/CD, Guards & Polish (Days 9-10)
- GitHub Actions workflow (lint, type-check, build)
- Vercel deployment config
- Route guards + permission components
- Loading states, error boundaries, toasts

---

## Tech Stack Versions

```
next@16.x
react@19.x
typescript@5.7+
tailwindcss@4.x
zustand@5.x
@supabase/supabase-js@2.x
@supabase/ssr@0.5.x
framer-motion@12.x
```

---

## 1. Project Initialization

```bash
# Create Next.js 16 project
npx create-next-app@latest vaultflow \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd vaultflow

# Install core dependencies
npm install zustand @supabase/supabase-js @supabase/ssr framer-motion
npm install clsx tailwind-merge lucide-react

# Install dev dependencies
npm install -D prettier eslint-config-prettier husky lint-staged
npm install -D @types/node
```

---

## 2. Folder Architecture

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   ├── team/page.tsx
│   │   │   └── billing/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/route.ts
│   │   └── webhooks/
│   │       └── stripe/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                    # Design system primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── toast.tsx
│   │   └── skeleton.tsx
│   ├── layout/                # Layout components
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── mobile-nav.tsx
│   │   └── breadcrumbs.tsx
│   ├── auth/                  # Auth-specific components
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   ├── oauth-buttons.tsx
│   │   └── auth-guard.tsx
│   └── providers/             # Context providers
│       ├── supabase-provider.tsx
│       ├── toast-provider.tsx
│       └── theme-provider.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser client
│   │   ├── server.ts          # Server client
│   │   ├── middleware.ts      # Auth middleware helper
│   │   └── admin.ts           # Service role client
│   ├── utils/
│   │   ├── cn.ts              # clsx + tailwind-merge
│   │   ├── constants.ts       # App constants
│   │   └── helpers.ts         # Generic helpers
│   └── validations/
│       ├── auth.ts            # Zod schemas for auth
│       └── org.ts             # Zod schemas for orgs
├── stores/
│   ├── auth-store.ts          # User session + profile
│   ├── ui-store.ts            # Sidebar, theme, modals
│   └── org-store.ts           # Current org context
├── hooks/
│   ├── use-auth.ts            # Auth convenience hook
│   ├── use-permissions.ts     # RBAC permission check
│   └── use-org.ts             # Org context hook
├── types/
│   ├── database.ts            # Supabase generated types
│   ├── auth.ts                # Auth types
│   └── index.ts               # Shared types
├── config/
│   ├── navigation.ts          # Sidebar nav items + permissions
│   ├── roles.ts               # RBAC role definitions
│   └── site.ts                # Site metadata
└── middleware.ts               # Next.js edge middleware
```

---

## 3. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=VaultFlow

# Stripe (Phase 3)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## 4. Supabase Database Schema

Run this SQL in the Supabase SQL Editor:

```sql
-- ============================================
-- VAULTFLOW DATABASE SCHEMA
-- Phase 1: Auth, Orgs, RBAC
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'manager', 'member');
CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired');

-- ============================================
-- ORGANIZATIONS TABLE
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
-- PROFILES TABLE (extends auth.users)
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
-- ORG MEMBERSHIPS (join table with roles)
-- ============================================

CREATE TABLE public.org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
-- UPDATED_AT TRIGGER
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

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

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
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organizations: members can view their orgs
CREATE POLICY "Org members can view org"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = organizations.id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = TRUE
    )
  );

-- Organizations: only owners/admins can update
CREATE POLICY "Admins can update org"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = organizations.id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin')
      AND org_memberships.is_active = TRUE
    )
  );

-- Memberships: members can view their org's memberships
CREATE POLICY "Members can view org memberships"
  ON public.org_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS m
      WHERE m.org_id = org_memberships.org_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
    )
  );

-- Memberships: only admins can insert/update memberships
CREATE POLICY "Admins can manage memberships"
  ON public.org_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships AS m
      WHERE m.org_id = org_memberships.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
      AND m.is_active = TRUE
    )
  );

-- Invites: admins can manage invites for their org
CREATE POLICY "Admins can manage invites"
  ON public.org_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = org_invites.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'admin')
      AND org_memberships.is_active = TRUE
    )
  );

-- Invites: invited users can view their own invites
CREATE POLICY "Users can view their invites"
  ON public.org_invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
```

---

## 5. Key Implementation Files

All source files are provided in the accompanying code files. Here's the implementation order:

### Step 1: Core Utilities
1. `src/lib/utils/cn.ts` — className merge utility
2. `src/config/site.ts` — Site metadata
3. `src/config/roles.ts` — RBAC definitions
4. `src/types/auth.ts` — Type definitions

### Step 2: Supabase Clients
1. `src/lib/supabase/client.ts` — Browser client (singleton)
2. `src/lib/supabase/server.ts` — Server client (per-request)
3. `src/lib/supabase/middleware.ts` — Middleware helper

### Step 3: Zustand Stores
1. `src/stores/auth-store.ts` — Session + profile state
2. `src/stores/ui-store.ts` — UI state (sidebar, theme, toasts)
3. `src/stores/org-store.ts` — Active org context

### Step 4: Auth Components & Pages
1. `src/components/auth/login-form.tsx`
2. `src/components/auth/signup-form.tsx`
3. `src/components/auth/oauth-buttons.tsx`
4. `src/app/(auth)/layout.tsx`
5. `src/app/(auth)/login/page.tsx`
6. `src/app/(auth)/signup/page.tsx`

### Step 5: Route Protection
1. `src/middleware.ts` — Edge middleware
2. `src/hooks/use-auth.ts` — Auth hook
3. `src/hooks/use-permissions.ts` — Permission hook
4. `src/components/auth/auth-guard.tsx`

### Step 6: Dashboard Shell
1. `src/components/layout/sidebar.tsx`
2. `src/components/layout/header.tsx`
3. `src/app/(dashboard)/layout.tsx`
4. `src/app/(dashboard)/dashboard/page.tsx`

### Step 7: CI/CD
1. `.github/workflows/ci.yml`
2. `vercel.json`
3. `Dockerfile`

---

## 6. Testing Checklist

After implementation, verify:

- [ ] User can sign up with email/password
- [ ] User can log in and see dashboard
- [ ] Profile auto-created on signup
- [ ] Organization can be created
- [ ] User gets 'owner' role on org they create
- [ ] RLS policies block unauthorized access
- [ ] Middleware redirects unauthenticated users to /login
- [ ] Sidebar shows/hides items based on role
- [ ] Zustand stores persist across navigation
- [ ] GitHub Actions CI runs on push
- [ ] Vercel preview deploys on PR
- [ ] Auth callback handles OAuth flow
- [ ] Toast notifications work for success/error states

---

## Next Phase Preview

**Phase 2 (Weeks 3-4):** Dashboard UI
- Analytics chart components (Recharts)
- Data tables with sorting/filtering/pagination
- SSR/ISR for dashboard pages
- Real-time Supabase subscriptions
- Financial metrics widgets
