# 06 --- Testing and Operations

## Test layers

### Unit tests

Use for pure business rules: - Money arithmetic and rounding. -
Price-list selection. - Quote calculations. - Allowed status
transitions. - Assignment quantity validation. - Permission policy
helpers.

### API integration tests

Use a dedicated test database or a reliable isolated database setup: -
Authentication/session behavior. - Order create/read/update. - Partner
and rider access boundaries. - Duplicate/idempotent requests. - Invalid
status transitions. - Quote approval and stale-version conflicts. -
Payment verification rules. - Custody event validation.

### End-to-end tests

Prioritize critical user journeys: 1. Customer books an order. 2. Admin
confirms and assigns it. 3. Rider records pickup. 4. Partner receives
and processes it. 5. Folded dispatches return delivery. 6. Rider
delivers and records COD or delivery evidence. 7. Admin sees final
order/payment status.

Also test: - Count discrepancy and revised quote approval. - Partner
delay. - Failed delivery. - Missing/damaged item case. - Unauthorized
partner/rider access. - Duplicate submit/scan. - Database backup
restoration procedure.

## Operational monitoring

At minimum monitor: - API 5xx rate and latency. - Failed login/OTP
spikes. - Database connection failures. - Failed scheduled jobs. -
Repeated idempotency conflicts. - Orders stuck in a state beyond its
expected duration. - Payment records awaiting verification. - COD
reconciliation discrepancies. - Upload failures. - Partner and rider
workflow exceptions.

Log a request ID on every request. Redact sensitive information.

## Deployment environments

-   Local development.
-   Staging with synthetic/test data.
-   Production with real data and restricted access.

Never use production customer data in local tests unless there is an
approved, minimized and protected process.

## Deployment

-   Managed web hosting for Next.js.
-   Managed Node.js/container hosting for Express.
-   Managed MongoDB with backups.
-   Private S3-compatible object storage.
-   HTTPS and explicit CORS configuration.
-   Secrets supplied through the host's secret manager/environment
    settings.
-   Health/readiness endpoints and graceful shutdown.
-   CI checks on pull requests and tested release promotion.

## Backups

-   Configure automated database backups appropriate to the selected
    provider/plan.
-   Define acceptable recovery point and recovery time targets before
    public launch.
-   Rehearse restoration periodically.
-   Protect backup access separately from app credentials.
-   A backup that has never been restored is not a verified recovery
    plan.

## Pilot dashboard metrics

Track: - Orders created and completed. - Average order value. - Customer
laundry revenue. - Partner processing cost. - Rider cost per order,
including failed attempts where possible. - Packaging and
payment/reconciliation cost. - Contribution per order before fixed
overhead. - Pickup and delivery punctuality. - Count discrepancies. -
Missing/damaged item incidents. - Rework and complaint rates. - Payment
and COD reconciliation status. - Repeat orders and customer retention.

Do not use illustrative targets as proof of profitability. Establish
actual baselines from the pilot.
