# VaultFlow Migration Workflow

## Goal

Use tracked Supabase CLI migrations as the canonical schema source so rollout, repair, and future production changes are auditable and repeatable.

## Canonical Path

- tracked migrations live in [supabase/migrations](c:/Users/HP/OneDrive/Desktop/mp/VaultFlow/supabase/migrations)
- local CLI state remains under `supabase/.temp` and is intentionally untracked
- the historical root SQL files remain as legacy release artifacts and reference material

## Fresh Environment

1. Link the project:
   - `supabase link --project-ref <project-ref>`
2. Apply tracked migrations:
   - `npm run db:migrations:push`
3. Review migration state:
   - `npm run db:migrations:list`

## Existing Environment Already Migrated Manually

If an environment already has the schema but was advanced before tracked migrations existed, repair its migration history once.

Example:

```bash
supabase migration repair --linked --status applied 20260412090000
supabase migration repair --linked --status applied 20260412090100
supabase migration repair --linked --status applied 20260412090200
supabase migration repair --linked --status applied 20260412090300
supabase migration repair --linked --status applied 20260412090400
supabase migration repair --linked --status applied 20260412090500
supabase migration repair --linked --status applied 20260412090600
```

After that:

```bash
npm run db:migrations:list
npm run db:migrations:push
```

## Current Migration Map

- `20260412090000_init_workspace_foundation.sql`
- `20260412090100_add_finops_core_schema.sql`
- `20260412090200_expand_workspace_rbac.sql`
- `20260412090300_add_vendor_assignment_scope.sql`
- `20260412090400_add_payment_lifecycle_ledger.sql`
- `20260412090500_add_webhook_idempotency.sql`
- `20260412090600_add_stripe_customer_and_adjustment_linkage.sql`
