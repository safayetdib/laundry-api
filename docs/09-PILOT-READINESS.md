# 09 --- Pilot Readiness Runbook

This runbook turns the implementation into a controlled pilot. It is a
checklist and a set of procedures, not proof that infrastructure is ready:
items that require real hosting, a real database or a payment provider are
marked **(requires live infra)** and must be done and verified by a human in
the target environment. Do not mark a readiness item done until it has been
performed and verified there.

## Current build state (what the code provides)

- API (`laundry-api`): auth (phone + password, server sessions + CSRF),
  catalogue/zones/pricing, orders + quote approval, atomic slot reservation,
  durable idempotency, partners + assignments with quantity-allocation checks,
  manual-first handovers + partner intake, rider delivery tasks, payments
  ledger (COD / manual bKash-Nagad verify / refunds), quality cases, route
  manifests. Health (`/health`) and readiness (`/ready`) probes, structured
  logs with secret redaction, graceful shutdown.
- Web (`laundry-web`): customer booking/ordering and admin order queue.
- Automated tests run without a database using in-memory repositories; the
  Mongoose persistence layer and payment-provider integrations are **not**
  covered by those tests and must be validated against real services.

## Deployment

- Managed Node.js/container hosting for the API; managed web hosting (or a
  container) for the web app; managed MongoDB with backups; private
  S3-compatible object storage for evidence photos. **(requires live infra)**
- Build: `pnpm install --frozen-lockfile && pnpm build`; run the API with
  `node dist/server.js`. A `Dockerfile` is provided in each repo as a starting
  image (build it in CI/hosting; it is not built in the development sandbox).
- Configuration is validated at startup (`src/config/env.ts`); the process
  exits with a clear message on invalid/missing configuration.
- Keep staging and production fully separate (data, credentials, database
  users). Never point development at production data.

### Required environment (API)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `production` in production |
| `PORT` | HTTP port |
| `MONGODB_URI` | MongoDB connection string (required) |
| `SESSION_TTL_HOURS` | Session lifetime (default 168) |
| `COOKIE_SECURE` | Force Secure cookies (defaults true in production) |
| `LOG_LEVEL` | Optional; sensible default per environment |

Object storage and payment-provider credentials are **not yet wired** (evidence
uses a stub; mobile payments are verified manually). Add them, with env
validation, before relying on uploads or automated payment confirmation.

### Web ↔ API

The web app sends `credentials: 'include'` and a CSRF header. In production the
web and API must share a parent domain, or CORS must be configured with exact
origins and credentialed requests (never a wildcard). Decide production
hostnames and cookie domain before launch (open question in `docs/07`).

## Backups and recovery **(requires live infra)**

- Enable automated MongoDB backups on the provider/plan.
- Define RPO/RTO before accepting real orders.
- Rehearse a restore into a scratch database and confirm an order's data,
  handover history and payment ledger come back intact. A backup that has
  never been restored is not a recovery plan.
- Protect backup access separately from application credentials.
- Document the rollback procedure for a bad deploy.

## Monitoring and error reporting **(requires live infra)**

Wire logs/metrics/alerts for at least: API 5xx rate and latency; failed
login/OTP spikes; DB connection failures; failed scheduled jobs; repeated
idempotency conflicts; slot-reservation oversell attempts; overdue/failing
route-manifest stops; orders stuck in a state; payments awaiting verification;
COD reconciliation discrepancies; upload failures. Every request already logs a
request id; keep that in the aggregator and keep redaction on.

## Rate limits and upload constraints

- Login is rate-limited in-memory (single instance). Before scaling to more
  than one instance, move rate limiting to a shared store, or front it at the
  gateway. Extend limits to OTP (when added), public tracking, uploads and
  payment endpoints.
- Set body-size and upload constraints at the gateway and in the object-storage
  presign policy once storage is configured.

## Manual fallback procedures

- WhatsApp/phone bookings are entered by operations through the same API as any
  other order (one central order system).
- Every core workflow works with manual service selection and manual
  confirmation; scanning is optional and never required.
- If mobile-payment verification is delayed, orders stay in a pending payment
  state and are reconciled later; COD is captured at delivery.
- If a rider or partner app is unavailable, operations can act on their behalf
  through staff endpoints (audited).

## End-to-end scenario testing before launch **(requires live infra)**

Run these against staging with real MongoDB (and storage/payments once wired):

1. Customer books → admin confirms → assigns the pilot partner.
2. Rider completes pickup → partner intake with a count discrepancy →
   processing → ready for collection.
3. Rider delivers → COD collected and reconciled.
4. Failed delivery → re-attempt.
5. Manual bKash/Nagad payment recorded → verified.
6. Refund issued and reflected in the balance.
7. Quality case opened after delivery and resolved.
8. Concurrent booking at the last slot (no oversell).
9. Unauthorized access attempts across customer/partner/rider boundaries.
10. Database backup restoration.

The API test suite already exercises the business-rule and HTTP behavior for
these paths with in-memory repositories; staging adds the persistence,
storage and payment layers.

## Pilot metrics and incident review

- Track the metrics listed in `docs/06-TESTING-AND-OPERATIONS.md` from real
  pilot data; do not treat illustrative targets as proof of profitability.
- Hold a short daily review during the pilot: orders completed, punctuality,
  count discrepancies, missing/damaged incidents, payment/COD reconciliation,
  and any open quality cases or P0/P1 items from `docs/08-LOOPHOLE-REVIEW.md`.

## Go-live checklist

- [ ] Staging deployed; API `/ready` green against real MongoDB **(live infra)**
- [ ] Production and staging credentials/databases separated **(live infra)**
- [ ] Automated backups enabled and a restore rehearsed **(live infra)**
- [ ] Monitoring and alerts wired; logs redacting secrets **(live infra)**
- [ ] CORS/cookie domain finalized for the chosen hostnames **(live infra)**
- [ ] Auth decisions in `docs/07` confirmed (login method, tracking links)
- [ ] Catalogue, customer prices and partner rate card published
- [ ] Pilot zones, slot capacities and cutoffs configured
- [ ] Object storage configured if evidence uploads are used **(live infra)**
- [ ] Payment proof/verification process agreed with operations
- [ ] Legal/privacy/partner terms reviewed by a qualified local lawyer
- [ ] End-to-end scenarios above executed on staging **(live infra)**
- [ ] No open P0 item in `docs/08-LOOPHOLE-REVIEW.md`

Items marked **(live infra)** cannot be completed in the development sandbox
and are the responsibility of whoever provisions the pilot environment.
