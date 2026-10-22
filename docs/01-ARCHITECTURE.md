# 01 --- Architecture

## High-level design

``` text
Customer web ─┐
Admin web ────┤
Partner portal├── HTTPS ── Folded Express API ── MongoDB
Rider web ────┘                    │
                                   ├── Private object storage
                                   ├── SMS/email/WhatsApp providers
                                   └── bKash/Nagad integrations (later)
```

All interfaces use one API and one identity system. The API is the
authoritative source for business rules and permissions.

## Repositories

### laundry-api

Node.js + Express + TypeScript, MongoDB/Mongoose, Zod, OpenAPI. Project
documentation currently lives under `docs/` in this repository.

### laundry-web

Next.js App Router + TypeScript, Tailwind CSS, shadcn/ui, TanStack
Query, React Hook Form. Use protected role-specific sections for
customer account, admin, partner and rider experiences.

### Separate docs repository (optional)

Product specification, OpenAPI export, state diagrams, operational
runbooks and decisions, if the docs outgrow `laundry-api/docs`.

### Shared contracts (optional)

Versioned shared DTOs and generated types. Avoid hand-maintaining
duplicated schemas if OpenAPI generation can provide the contract.

## API directory layout

``` text
src/
├── app.ts
├── server.ts
├── config/
├── middleware/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── addresses/
│   ├── services/
│   ├── pricing/
│   ├── zones/
│   ├── orders/
│   ├── partners/
│   ├── assignments/
│   ├── scheduling/        # pickup/delivery windows, slot reservations
│   ├── routing/           # route manifests and ordered rider stops
│   ├── handovers/         # pickup/intake/collection/delivery events
│   ├── delivery/
│   ├── payments/
│   ├── quality-cases/
│   ├── notifications/
│   ├── reports/
│   └── audit/
├── integrations/
├── jobs/
└── shared/
    └── scan-resolution/   # optional, replaceable code resolver
```

A module normally has routes, controller, service, repository/model,
schema, types and tests. Avoid empty abstractions. Business rules belong
in services, not controllers.

Bag identity is not a core module. Do not add a `bags/` module, bag
collection or registration workflow as a pilot dependency; introduce it
only when a real operational need justifies individual bag tracking, at
which point bag identity is optional metadata on orders/handovers.

### Scan resolution (optional)

Scanning is never required. If a scan assist is added, isolate it in a
small, replaceable `scan-resolution` component: it interprets a code and
returns an allowed action or record (for example, "preselect service X"),
and the caller still runs the normal authentication, authorization,
order/assignment validation, count confirmation and handover confirmation.
Unknown, invalid, disabled or unsupported codes fail safely and fall back
to manual entry. A service sticker may preselect a service; it does not
identify an individual bag unless explicitly designed and registered for
that purpose.

## Web directory layout

``` text
src/
├── app/
│   ├── (store)/
│   ├── (account)/
│   └── (operations)/
│       ├── admin/
│       ├── partner/
│       └── rider/
├── components/
├── features/
├── lib/
│   ├── api/
│   ├── auth/
│   └── utils/
└── types/
```

Do not assume Next.js route protection alone is sufficient. The Express
API independently authorizes every request.

## Architectural boundaries

-   UI: presentation, forms, client-side interaction and query caching.
-   API controllers: HTTP parsing, validation integration and response
    mapping.
-   API services: business rules and state transitions.
-   Repositories/models: database operations and persistence
    constraints.
-   Integrations: payment, messaging, storage and other providers.
-   Jobs: retry-safe scheduled tasks.
-   Audit: privileged-action history.

## Future expansion without redesign

-   Multiple partners: keep `PartnerOrderAssignment` separate from
    `Order`.
-   Multiple zones: make zone and slot configuration data-driven.
-   Automated routing later: keep route manifests and stops as first-class,
    data-driven records (ordered stops, task types, stop status, timing and
    capacity inputs) so an optimizer can populate stop order without a
    schema redesign. The pilot fills stop order manually; the model does
    not change when optimization is added.
-   Optional bag tracking: add bag identity as optional metadata on
    orders/handovers (and a `bags` collection only then), without changing
    the order/handover core.
-   Additional services/pricing units: use catalogue configuration and
    versioned price lists.
-   Native apps: use the same API and authentication model, with an
    appropriate mobile token/session strategy.
-   Marketplace: add customer-visible partner discovery and marketplace
    policies as a new product layer; do not change Folded's initial
    managed-service ownership model by default.
-   Scale: extract a module into a separate service only when load, team
    boundaries or reliability needs justify the cost.

## API and runtime

-   REST under `/api/v1`.
-   OpenAPI is the API contract.
-   Use structured JSON logs, request IDs, health/readiness endpoints
    and graceful shutdown.
-   Use managed hosting for web, API, database and private object
    storage.
-   Keep staging and production data separate.
-   Use transactions only where the MongoDB deployment supports them and
    the operation needs atomic multi-document writes.
-   External side effects require explicit states and retry-safe
    processing; a DB transaction does not include a payment or messaging
    provider.
