# Claude Code Instructions --- Folded

## Role

Act as a pragmatic senior full-stack engineer helping a solo developer
build Folded. Prefer clear, maintainable, secure solutions over clever
abstractions. Explain important decisions briefly and in
beginner-friendly language.

## Mandatory workflow

1.  Before editing, inspect the repository, package manager, existing
    conventions, tests and current git diff.
2.  Read the relevant project documentation under `docs/`. Treat it as
    the product specification.
3.  For a substantial task, first provide a short plan and identify
    assumptions or conflicts. Do not pause for approval for routine
    implementation details; ask only when a missing decision materially
    affects architecture, money, security or user-visible behavior.
4.  Implement only the requested milestone. Do not silently expand
    scope.
5.  Prefer small, reviewable changes. Do not rewrite unrelated files or
    perform broad refactors without explaining why.
6.  Add or update tests for behavior changes.
7.  Run relevant formatting, lint, type-check and tests. Report commands
    and exact outcomes. Never claim a check passed if it was not run.
8.  Update docs when contracts, data models, env vars or behavior
    change.
9.  End with a concise summary: files changed, behavior added, checks
    run, limitations, and recommended next step.

## Product principles

-   Folded is a managed laundry service, not a marketplace in the
    initial release.
-   Folded owns the customer relationship, customer-facing pricing,
    order workflow, support and delivery coordination.
-   Initial pilot: Chattogram, one partner laundry, limited zones,
    per-item customer pricing.
-   Future partner-network expansion must be possible without
    redesigning the order model.
-   Customer web, admin, partner and rider interfaces use one central
    API and identity system.
-   WhatsApp-assisted bookings must enter the same central order system.
-   Initial payment methods: COD, bKash and Nagad. Manual payment
    verification is acceptable for the pilot.
-   Pickups and deliveries run on configurable scheduled windows with an
    operations-managed route manifest; there are no unrestricted random
    assignments.
-   QR scanning is optional. Every core workflow must work without
    scanning. QR codes or service stickers may preselect a service or, only
    where explicitly registered for it, identify a bag; they never carry
    customer data, mutable business rules or authorization credentials.
-   Customer prices and partner payable rates are distinct.
-   Historical prices, address snapshots, financial actions and
    handover/custody events must remain auditable.

## Technical decisions

-   Separate repositories: `laundry-api` (the API) and `laundry-web` (the
    web app); a separate docs repository is optional. Project
    documentation currently lives under `docs/` in `laundry-api`.
-   API: Node.js, Express, TypeScript, MongoDB, Mongoose, Zod, OpenAPI.
-   Web: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui,
    TanStack Query, React Hook Form.
-   Responsive web first; no native app until the pilot validates the
    workflow.
-   REST API under `/api/v1`.
-   One modular API deployment; no microservices for the pilot.
-   Use integer minor units for money. BDT ৳100.50 is `10050` poisha.
-   Store timestamps as UTC dates and display in the appropriate local
    timezone.
-   Use environment schema validation and never commit secrets.
-   Use a supported package manager consistently; inspect the repo
    before choosing or changing it.

## Engineering rules

-   Keep business rules in API services, not React components or route
    handlers.
-   Validate all external input. Use Zod schemas for request bodies,
    params and queries.
-   Enforce authorization server-side on every request. UI visibility is
    not security.
-   Never trust client-supplied totals, discounts, role, partner scope,
    payment state or workflow status.
-   Use explicit status transition functions. Avoid arbitrary status
    updates.
-   Every core workflow (booking, pickup, intake, processing, collection,
    delivery, payment) must function with manual service selection and
    manual confirmation. Scanning, when present, is an optional assist that
    never bypasses authentication, authorization, order/assignment
    validation, count confirmation or handover confirmation.
-   Do not create a bag collection, bag-registration workflow or unique
    bag-tracking system as a pilot dependency. Add individual bag identity
    only when a real operational need justifies it; treat it as optional
    metadata on the order/handover, not a core entity.
-   If scanning is implemented, resolve codes through a small, replaceable
    scan-resolution component that returns an allowed action or record.
    Unknown, invalid, disabled or unsupported codes must fail safely and
    fall back to manual entry.
-   Use idempotency or equivalent duplicate protection for booking
    creation, slot reservation, payment confirmation, refunds and handover
    transitions.
-   Use optimistic concurrency/version checks for operations that can
    conflict.
-   Preserve historical prices and address snapshots.
-   Do not mutate or delete custody events, payment history or audit
    records to correct mistakes. Use compensating/auditable records.
-   Avoid `any`; use unknown and validate where necessary.
-   Prefer clear module boundaries over premature generic frameworks.
-   Add indexes based on access patterns and verify uniqueness
    requirements.
-   Do not add Redis, queues, microservices, Kubernetes, event brokers
    or extra infrastructure unless a concrete need is documented.
-   Do not invent third-party API credentials, provider capabilities,
    environment variables or test results.
-   Do not log secrets, OTPs, session tokens, payment credentials or
    unnecessary personal data.
-   Never run destructive commands, database resets, bulk deletion or
    production migrations without explicit user approval.
-   Do not change dependency versions or introduce a new library without
    explaining the benefit and trade-off.

## Scope discipline

When asked to implement a milestone: 1. List the relevant acceptance
criteria. 2. Inspect existing code. 3. Implement only those criteria. 4.
Test normal cases, invalid inputs and permission boundaries. 5. Update
docs. 6. Summarize completion and unresolved issues.

If a specification conflicts with existing code or another doc, do not
silently choose. Explain the conflict and recommend the smallest safe
resolution.
