# VaultFlow - Phase 1: Foundation and Auth System

## Overview
**Duration:** 2 weeks  
**Goal:** Establish a secure multi-tenant SaaS foundation with authentication, RBAC, Supabase integration, Zustand state, and deployment-ready project structure.

## Sprint Breakdown

### Sprint 1.1 - Scaffold and Design System
- Next.js, TypeScript, and Tailwind setup
- Base folder architecture
- Shared UI primitives and tokens
- ESLint, Prettier, and Husky configuration

### Sprint 1.2 - Supabase Schema and Authentication
- Organizations, profiles, memberships, and invites schema
- Supabase Auth setup
- Profile creation and membership bootstrap flows
- Row Level Security baseline

### Sprint 1.3 - RBAC and State
- Role hierarchy and permission matrix
- Route protection and auth-aware navigation
- Zustand stores for auth, UI, and organization state
- Session-aware server/client helpers

### Sprint 1.4 - CI, Guards, and Foundation Polish
- Build and typecheck pipeline
- Vercel deployment baseline
- Auth guards and permission components
- Loading states, toasts, and error boundaries

## Expected Output

- Users can authenticate and switch into tenant-aware workspace context
- RBAC is enforced in navigation, routes, and UI actions
- Supabase foundation is ready for invoices, clients, and billing layers
