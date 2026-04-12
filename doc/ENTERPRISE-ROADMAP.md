# VaultFlow Enterprise Roadmap

## Product Direction

VaultFlow is evolving from a polished financial dashboard and invoice demo into a tenant-aware finance operations platform for SaaS teams. The product direction should stay centered on billing operations, client and invoice workflows, access governance, analytics, and subscription-backed commercial controls.

The platform should ultimately support a broader enterprise operating model:

- secure authentication with tenant-aware onboarding
- workspace switching and organization lifecycle management
- a richer role system spanning owner, admin, finance manager, staff, vendor, and viewer personas
- Stripe-driven subscription lifecycle management with plan visibility and billing control
- financial operations workflows for invoices, reminders, payments, status tracking, and reporting
- admin and moderation tooling for suspicious activity, billing anomalies, support workflows, and tenant review
- premium product UX with clean motion, excellent empty and loading states, and responsive admin usability

## Target Capability Model

### Workspace and tenant management

- workspace creation and switching
- organization profile, branding, and settings controls
- invitation lifecycle, membership approval, role changes, suspension, and restoration
- usage visibility per tenant

### Billing and subscriptions

- free, pro, and enterprise plans as a baseline
- roadmap support for seat-based billing, usage-based billing, add-ons, coupons, and taxes
- upgrade, downgrade, proration, renewal, grace-period, and failed-payment recovery visibility
- billing portal and invoice history access

### Invoices and financial workflows

- lifecycle support for draft, scheduled, sent, viewed, paid, overdue, partially paid, voided, and refunded states
- branded templates, notes, terms, taxes, discounts, and due-date controls
- recurring invoice and reminder automation roadmap
- downloadable and shareable PDFs
- customer and transaction history visibility

### Governance, trust, and auditability

- audit trails for auth, billing, settings, role changes, and invoice actions
- moderation and internal review tooling
- session and security visibility, with roadmap room for 2FA
- exportable reports and event histories

### Premium experience layer

- advanced filters, saved views, and report presets
- notification center and activity timeline views
- command palette and high-signal operator shortcuts
- predictive insights and anomaly detection over revenue or overdue behavior
- mobile and tablet support for serious admin workflows

## Delivery Model

- Branch from `dev` for each major phase.
- Keep sprint work grouped into a small set of intentional commits inside the phase branch.
- Merge only completed, verified phase branches back into `dev`.
- Push `dev` after each phase merge so the integration branch always reflects the latest validated platform state.

## Recommended Branch Map

- `feature/phase-01-workspace-foundation`
- `feature/phase-02-finops-operations-surface`
- `feature/phase-03-billing-automation-and-revenue`
- `feature/phase-04-governance-admin-and-hardening`

If a phase becomes too broad, create sprint branches underneath it, for example:

- `feature/phase-02-sprint-01-invoice-ops`
- `feature/phase-02-sprint-02-team-governance`
- `feature/phase-03-sprint-01-billing-lifecycle`

## Phase 1

Branch: `feature/phase-01-workspace-foundation`

Objective:
Establish a premium workspace shell with strong interaction quality, reliable auth and org affordances, and clean navigation patterns that support the rest of the platform.

Sprint 1.1
- Audit current routes, component quality, and architecture seams.
- Normalize header, sidebar, auth menu, org switching, and navigation hierarchy.
- Remove obvious dead-end UI affordances and replace them with coherent workspace actions.

Recommended commit split:
- `feat: upgrade workspace header, user menu, and org switching`
- `chore: clean sidebar affordances and remove dead-end navigation seams`

Sprint 1.2
- Improve dashboard, landing, and shell-level polish.
- Harden loading, empty, and permission-denied states.
- Align motion, spacing, and hierarchy across core routes.

Recommended commit split:
- `feat: refine landing experience and premium dashboard shell polish`
- `chore: tighten shared ui states and route-level consistency`

Exit criteria:
- Workspace shell feels enterprise-grade.
- Auth and org switching are coherent.
- Primary navigation and role-aware entry points are polished and trustworthy.
- The app reads as a serious B2B workspace instead of a stitched-together demo.

## Phase 2

Branch: `feature/phase-02-finops-operations-surface`

Objective:
Turn invoices and clients into truly operational workflows with creation, lifecycle actions, better tables, and stronger team collaboration patterns.

Sprint 2.1
- Add lightweight create flows for clients and invoices.
- Improve list views with summary cards, quick actions, and better filtering.
- Add row action menus for invoice and client workflows.

Recommended commit split:
- `feat: add quick-create flows for invoices and clients`
- `feat: add operational row actions and richer list analytics`

Sprint 2.2
- Introduce invoice lifecycle enhancements: draft, sent, paid, overdue, cancelled.
- Strengthen detail pages with faster actions and contextual information.
- Expand activity log consistency and event clarity.

Recommended commit split:
- `feat: deepen invoice lifecycle actions and detail views`
- `chore: align activity and operational state feedback`

Sprint 2.3
- Expand team settings into a real admin surface with invite lifecycle, role management, and access moderation.
- Unify access-control affordances between admin and settings areas.

Sprint 2.4
- Expand the role model toward finance manager, staff, vendor, and viewer capabilities.
- Prepare entity-specific action menus and permission-aware views for vendor or customer-facing workflows.
- Normalize lifecycle states, naming, and permission checks across the product.

Recommended commit split:
- `feat: implement invite lifecycle and member moderation workflows`
- `feat: unify admin and team access management surfaces`
- `feat: expand role model and permission-aware operational surfaces`

Exit criteria:
- Core business entities have real create and manage workflows.
- Tables are actionable instead of read-only.
- Admins can manage people and operational work from the app itself.

## Phase 3

Branch: `feature/phase-03-billing-automation-and-revenue`

Objective:
Evolve billing from simple plan switching into a revenue operations layer with usage visibility, lifecycle transparency, and monetization controls.

Sprint 3.1
- Add plan usage insights, billing status cards, and subscription visibility.
- Improve payment method and portal management UX.
- Align Stripe lifecycle states with clearer product messaging.

Recommended commit split:
- `feat: add billing usage insights and subscription health surfaces`
- `feat: strengthen payment and portal management flows`

Sprint 3.2
- Add invoice reminders, collection states, and optional payment tracking extensions.
- Introduce revenue intelligence modules such as churn risk, overdue concentration, and plan expansion signals.

Recommended commit split:
- `feat: add collections and payment lifecycle intelligence`
- `feat: surface revenue operations insights across billing and reports`

Sprint 3.3
- Prepare roadmap-level monetization features: seat policies, overage logic, plan entitlements, feature gating.
- Add customer success hooks for enterprise accounts.

Sprint 3.4
- Prepare tax, VAT, coupon, and invoice-history enhancements.
- Add roadmap support for partially paid, refunded, and voided invoice states.
- Improve billing anomaly detection and operator alerting.

Recommended commit split:
- `feat: introduce entitlements and plan policy groundwork`
- `feat: add enterprise account signals and csm handoff hooks`
- `feat: extend advanced billing states and compliance-ready billing metadata`

Exit criteria:
- Billing is not just a pricing page but an operating surface.
- Usage, plan posture, and payment health are visible and actionable.
- The app demonstrates credible SaaS monetization architecture.

## Phase 4

Branch: `feature/phase-04-governance-admin-and-hardening`

Objective:
Push VaultFlow into a stronger enterprise posture with governance, observability, resilience, deployment hygiene, and scale-readiness.

Sprint 4.1
- Expand admin oversight into moderation queues, policy controls, and tenant posture summaries.
- Improve audit readability and event taxonomy.
- Add sharper controls for privileged workflows.

Recommended commit split:
- `feat: expand governance dashboards and policy controls`
- `feat: improve audit quality and privileged workflow guardrails`

Sprint 4.2
- Add production hardening: dependency updates, security review, caching review, route protection checks.
- Improve deployment documentation, env validation, and release readiness.

Recommended commit split:
- `chore: harden app security, dependency posture, and environment safety`
- `docs: finalize deployment, rollout, and operational runbook guidance`

Sprint 4.3
- Final brand and UX pass.
- Capture showcase-ready screenshots, README updates, and portfolio framing.

Sprint 4.4
- Add command palette, actionable notifications, saved filters, and operator productivity boosts.
- Finalize premium loading, empty, success, and failure states throughout the product.

Recommended commit split:
- `feat: complete final enterprise ux polish`
- `docs: package vaultflow as a portfolio-grade product case study`
- `feat: deliver operator productivity and premium workflow finishing touches`

Exit criteria:
- Governance and audit surfaces feel credible.
- Deployment and security posture are documented and hardened.
- The repo reads like a serious SaaS platform rather than a feature demo.

## Merge Workflow

For each phase:

1. Create the phase branch from `dev`
2. Deliver sprint work as a handful of clean commits
3. Run verification:
   - `npm run typecheck`
   - `npm run build`
4. Push the phase branch
5. Merge phase branch into `dev`
6. Push `dev`
7. Start the next phase from updated `dev`

## Notes

- If a sprint turns out to be unusually large, split into sprint branches under the phase naming convention, for example `feature/phase-02-sprint-01-invoice-ops`.
- Keep branch names product-meaningful rather than generic.
- Do not merge partially complete operational surfaces into `dev`; prefer finishing the full sprint slice before integration.
