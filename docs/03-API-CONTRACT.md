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

-   `POST /auth/login`
-   `POST /auth/logout`
-   `GET /auth/me`

### Services and pricing

-   `GET /services`
-   `GET /pricing?zoneId=...`
-   `POST /admin/price-lists`
-   `POST /admin/price-lists/:id/publish`

### Zones

-   `GET /zones`
-   `GET /zones/availability?zoneId=...&date=...`

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

Partner scope is derived from the authenticated user/session. Do not
trust a client-supplied `partnerId`.

### Later modules

-   `POST /custody/scan`
-   `GET /orders/:id/custody`
-   `GET /rider/tasks`
-   `POST /delivery-tasks/:id/complete`
-   `POST /orders/:id/payment-records`
-   `POST /payments/:id/confirm`
-   `POST /quality-cases`

Do not implement all endpoints in the first milestone. Follow the
roadmap.

## Idempotency

Use an idempotency key for actions that must not happen twice, including
order creation, payment confirmation, refund requests and custody
transitions. Scope keys to the authenticated actor and operation. Store
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
