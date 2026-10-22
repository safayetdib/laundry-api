# 03 --- API Contract

## Base conventions

-   Base URL path: `/api/v1`.
-   JSON request and response bodies.
-   Use OpenAPI as the contract.
-   Use a request ID in logs and error responses.
-   Use cursor or page-based pagination consistently.
-   Validate path params, query params and bodies with Zod.
-   Never expose raw Mongoose documents as public API responses.
-   Use DTOs to control output fields.
-   Use consistent timestamps in ISO 8601 UTC form.

## Success response

``` json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

For lists, `meta` should also contain pagination information.

## Error response

``` json
{
  "error": {
    "code": "ORDER_VERSION_CONFLICT",
    "message": "The order has changed. Refresh and try again.",
    "details": null,
    "requestId": "..."
  }
}
```

Do not expose stack traces, internal query details or secrets.

## HTTP status codes

-   200: successful read/update
-   201: resource created
-   400: invalid input
-   401: unauthenticated
-   403: not authorized
-   404: not found or access deliberately concealed
-   409: state conflict, duplicate action or stale version
-   422: request is structurally valid but business rules reject it
-   429: rate limited
-   500: unexpected error

## Initial endpoint map

### Auth

-   `POST /auth/login` (phone + password)
-   `POST /auth/logout`
-   `GET /auth/me`
-   `POST /auth/request-otp` — optional phone-OTP login; issues a code via SMS
    (a real provider is a pending integration; with the stub sender no code is
    delivered). Rate-limited; response never reveals whether an account exists.
-   `POST /auth/verify-otp` — verifies the code and starts a session, creating a
    customer on first login.

### Services and pricing

-   `GET /services`
-   `GET /pricing?zoneId=...`
-   `POST /admin/price-lists`
-   `POST /admin/price-lists/:id/publish`

### Zones and scheduling

-   `GET /zones`
-   `GET /zones/availability?zoneId=...&date=...` — returns selectable
    pickup/delivery windows with remaining capacity. Availability is
    advisory; capacity is reserved atomically at booking time, not by this
    read.

### Orders

-   `POST /orders`
-   `GET /orders/:orderCode`
-   `GET /customer/orders`
-   `POST /orders/:id/confirm`
-   `POST /orders/:id/approve-quote`
-   `POST /orders/:id/cancel`

### Admin

-   `GET /admin/orders`
-   `GET /admin/partners`
-   `POST /admin/partners`
-   `POST /admin/orders/:id/assignments`

### Partner

-   `GET /partner/assignments`
-   `POST /partner/assignments/:id/accept`
-   `POST /partner/assignments/:id/status`
-   `POST /partner/assignments/:id/intake` — records partner-received
    counts and discrepancies without overwriting the pickup count.

Partner scope is derived from the authenticated user/session. Do not
trust a client-supplied `partnerId`.

### Routing and rider (operations-managed)

-   `GET /admin/route-manifests` / `POST /admin/route-manifests`
-   `POST /admin/route-manifests/:id/stops` — set/reorder ordered stops
    while the manifest is draft.
-   `POST /admin/route-manifests/:id/assign` — assign a rider and publish.
-   `GET /rider/manifests` — the authenticated rider's assigned manifests
    and ordered stops.
-   `POST /rider/stops/:id/complete` — complete a pickup/delivery stop. The
    rider selects the order and service **manually**; a scan is never
    required. Records actor, timestamp, count, condition notes and failure
    reason where applicable.

### Handovers and optional scan resolution

-   `POST /orders/:id/handovers` — record a pickup/intake/collection/
    delivery handover with manual service and count confirmation. A
    `scanAssisted` flag may be set, but a scan alone is never proof.
-   `GET /orders/:id/handovers` — append-only handover history.
-   `POST /scan/resolve` *(optional, only if scanning is enabled)* —
    interprets a code and returns an allowed action or record (e.g.
    preselect a service). It performs no state change on its own and never
    bypasses authentication, authorization, order/assignment validation,
    count confirmation or handover confirmation. Unknown, invalid, disabled
    or unsupported codes return a safe error and the client falls back to
    manual entry.

### Later modules

-   `GET /rider/tasks`
-   `POST /delivery-tasks/:id/complete`
-   `POST /orders/:id/payment-records`
-   `POST /payments/:id/confirm`
-   `POST /quality-cases`

Do not implement all endpoints in the first milestone. Follow the
roadmap. Endpoints for individual bag tracking are intentionally omitted
and added only if pilot evidence justifies them.

## Idempotency

Use an idempotency key for actions that must not happen twice, including
order creation, slot reservation, payment confirmation, refund requests
and handover transitions. Scope keys to the authenticated actor and
operation. Store
the outcome long enough to prevent accidental duplicate requests.
Reusing a key with a materially different request must return a
conflict.

## Concurrency

Use a version field or optimistic concurrency control for order edits
and quote approval. If a request references a stale quote version,
reject it with a conflict response.

## Order quote rules

-   The server calculates every quote.
-   Client-provided totals are ignored/rejected.
-   Each quote has a version.
-   A change to count, service, fee or discount creates a new version.
-   Approval references the current version and authenticated customer.
-   No paid add-on proceeds without the required customer approval.

## API security rules

Every route must specify authentication and authorization requirements.
Public routes must be explicitly marked public. Avoid accidental public
access due to missing middleware.
