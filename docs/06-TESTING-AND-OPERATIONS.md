# 06 --- Testing and Operations

## Test layers

### Unit tests

Use for pure business rules: - Money arithmetic and rounding. -
Price-list selection. - Quote calculations. - Allowed status
transitions. - Assignment quantity validation. - Permission policy
helpers.

### API integration tests

Use a dedicated test database or a reliable isolated database setup: -
Authentication/session behavior. - Order create/read/update. - Concurrent
booking at the last available slot (atomic capacity, no oversell). -
Partner and rider access boundaries. - Duplicate/idempotent requests. -
Invalid status transitions. - Route manifest stop transitions and failure
reasons. - Quote approval and stale-version conflicts. - Payment
verification rules. - Handover event validation (manual, and scan-assisted
if scanning is enabled). - Preservation of both pickup and partner-received
counts.

### End-to-end tests

Prioritize critical user journeys: 1. Customer books an order into a
scheduled window. 2. Admin confirms, assigns it and arranges a route
manifest. 3. Rider completes the pickup stop with manual service selection.
4. Partner receives and processes it. 5. Folded dispatches return delivery.
6. Rider delivers and records COD or delivery evidence. 7. Admin sees final
order/payment status.

Also test: - The full journey without any scanning. - Count discrepancy and
revised quote approval. - Partner delay. - Failed delivery stop with a
recorded reason. - Missing/damaged item case. - Unauthorized partner/rider
access. - Duplicate submit (and scan, if scanning is enabled). - Database
backup restoration procedure.

## Operational monitoring

At minimum monitor: - API 5xx rate and latency. - Failed login/OTP
spikes. - Database connection failures. - Failed scheduled jobs. -
Repeated idempotency conflicts. - Slot-reservation conflicts and
oversell attempts. - Route-manifest stops overdue or failing. - Orders
stuck in a state beyond its expected duration. - Payment records awaiting
verification. - COD reconciliation discrepancies. - Upload failures. -
Partner and rider workflow exceptions.

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
