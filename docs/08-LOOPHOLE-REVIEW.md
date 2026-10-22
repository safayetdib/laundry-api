# 08 --- Loophole Review and Required Safeguards

This document is a design review of the current specification, not a
penetration test, legal review, or proof that an implementation is
secure. Claude Code must treat these safeguards as requirements and
update the relevant implementation docs when they are resolved.

## Priority definitions

-   **P0 --- Must resolve before real customer orders or money:** can
    cause financial inconsistency, unauthorized access, lost custody
    evidence, or double booking.
-   **P1 --- Must resolve before the affected workflow launches:**
    operational or privacy failure likely if omitted.
-   **P2 --- Can follow the pilot:** useful hardening or scale
    improvements that do not need to block the first controlled pilot.

## P0 --- Required before accepting real orders

### 1. Pickup slot capacity can oversell

**Gap:** A `capacity` value on a zone slot is not enough. Two requests
may check the same remaining capacity simultaneously and both confirm.

**Requirement:** - Model a dated slot instance or reservation record
with `zoneId`, start/end, capacity, reserved count and status. - Reserve
capacity atomically; do not rely on a frontend availability check. -
Define reservation expiry for unconfirmed bookings. - Prevent double
reservation with a transaction or a carefully designed atomic
conditional update. - Release capacity on valid cancellation/expiry. -
Test simultaneous booking attempts at the last available slot.

### 2. Payment records need a precise financial ledger model

**Gap:** A generic payment record with `eventType` is too vague to
guarantee that retries, partial collections, refunds and COD
reconciliation do not double count.

**Requirement:** - Separate a payment attempt/collection from immutable
payment events or ledger entries. - Every entry includes amount,
currency, event type, status, actor/provider reference, timestamps and a
unique idempotency/provider-event key. - Represent successful
collections and refunds as separate records; never overwrite a
successful collection to simulate a refund. - Derive the order's
paid/refunded/outstanding balance from verified entries, or maintain a
cached summary with a reconciliation test. - Define whether amounts are
gross, net, fee or refund, and prevent negative/over-refunded totals. -
COD collection must record expected amount, actual collected amount,
collector, time and reconciliation status. - Manual bKash/Nagad
verification must record who verified it and what reference/evidence was
checked. - A screenshot or customer-provided transaction ID is not
itself proof of payment. - Test duplicate confirmation, partial payment,
duplicate refund and amount mismatch cases.

### 3. Idempotency is described but not persisted

**Gap:** Telling the API to use idempotency keys is incomplete without
storage, uniqueness and replay behavior.

**Requirement:** - Create an `idempotencyRecords` collection or
equivalent durable store. - Unique scope: authenticated actor/client +
operation/route + key. - Store a normalized request hash,
processing/result status, response reference and expiry policy. - Same
key + same request returns the original outcome. - Same key + different
request returns `409 Conflict`. - Concurrent requests with the same key
must not execute the business action twice. - Add tests for concurrent
duplicate order creation, payment confirmation and custody scans.

### 4. Order, assignment, delivery and payment state machines are underspecified

**Gap:** The docs list states but do not fully define who may transition
between them, required preconditions, side effects, retries or exception
paths.

**Requirement:** - Implement explicit transition functions with an
allowed-transition matrix. - Every transition declares allowed actor
roles, state preconditions, required records and emitted side effects. -
Do not expose generic `PATCH status` endpoints to clients. - Define
failed pickup, customer unavailable, quote awaiting approval, partner
rejection, rework, cancelled-after-pickup, failed delivery,
return-to-partner and partial fulfillment. - Keep order status separate
from partner assignment, delivery task, payment and quality-case
status. - Use optimistic concurrency/version checks for transitions. -
Audit privileged overrides with reason and actor. - Store the
order/assignment state change and corresponding audit/event record
atomically when they must not diverge.

### 5. Quote approval and price changes need a firm protocol

**Gap:** A quote version is mentioned, but the exact source of truth and
expiry/approval behavior are not fully specified.

**Requirement:** - API creates a quote with a unique quote ID/version,
line details, fees, taxes if applicable, total, currency, price-list
versions and expiry. - Customer approval references the exact current
quote ID/version and is authorized for that order. - A revised
count/service/fee creates a new quote and invalidates prior approval. -
Define whether the order can be processed while awaiting approval;
default: no chargeable processing begins. - Define quote expiry and what
happens if the price list changes after a quote is issued. - Calculate
and validate all amounts on the server using integer minor units and
documented rounding rules. - Reject stale approvals and concurrent
conflicting edits.

### 6. QR identifiers and custody handovers need replay protection

**Gap:** Random QR IDs and append-only events are good, but a scan
endpoint could still accept replayed or out-of-order handovers or
falsely record a two-party transfer.

**Requirement:** - QR code contains only a random opaque bag identifier,
not customer details, order totals or bearer authorization. - Require
authenticated actor, authorized assignment/task, expected current
holder/state, expected event type and idempotency key. - Define who is
permitted to initiate and confirm each handover. Where practical, record
both handing-over and receiving party confirmation; if operationally
impractical, record the limitation and compensating checks. - Use
compare-and-set/optimistic concurrency so only one valid transition
wins. - Record event actor, from/to parties, event time, server-recorded
time, count, discrepancy, evidence references and request ID. - Do not
allow deleting/editing historical events. Corrections must be separate
events. - Test duplicate QR scans, wrong order/bag, wrong partner,
out-of-order scan, stale state and replay.

### 7. Authorization must cover object-level and field-level access

**Gap:** Role lists alone do not prevent IDOR or over-sharing.

**Requirement:** - Every endpoint has an authorization policy test. -
Customers can access only their own orders and addresses. - Partner
staff can access only their partner's assignments and the minimum
customer data needed. - Riders can access only assigned tasks and
minimum necessary contact/address data. - Partner/rider clients cannot
set `partnerId`, `riderId`, role, payment state, totals or arbitrary
status through mass assignment. - Return explicit DTOs with allowlisted
fields. - Use deny-by-default middleware and test negative access paths.

### 8. Authentication/session and public tracking design must be finalized

**Gap:** Login and session strategy remain open. Public tracking links
can leak order information if they use a guessable order code.

**Requirement before production:** - Decide login method and implement
abuse protection, session expiry, revocation, rotation and account
recovery. - If browser cookies are used, define cookie domain, Secure,
HttpOnly, SameSite and CSRF protection for state-changing requests. -
Use exact CORS origins; no wildcard with credentialed requests. - If a
tracking link is used, use a high-entropy token stored hashed where
practical, scoped to read-only data, revocable and expiring. An order
code alone must not grant access. - Do not expose full addresses, phone
numbers, photos or payment references on public tracking pages. - Test
session fixation/revocation, CSRF where applicable, brute-force limits
and unauthorized tracking access.

## P1 --- Resolve before launching each affected workflow

### 9. Price-list overlap and selection ambiguity

**Gap:** `active` and effective dates do not by themselves guarantee a
single applicable rate.

**Requirement:** - Define precedence: partner-specific vs general
partner rate, zone-specific vs default, service/garment match, effective
date. - If zero or multiple equally applicable prices match, reject
quote creation and alert operations; never silently pick one. - Price
publication must validate entries and effective windows. - Keep old
versions for historical orders. - Add tests for missing rates,
overlapping windows, inactive entries, zone precedence and
partner-specific rates.

### 10. Assignment quantity and multi-partner concurrency

**Gap:** Checking assigned quantities in application code can race when
two admins assign the same order item simultaneously.

**Requirement:** - Validate aggregate active assignment quantities per
order item against confirmed quantity. - Serialize or transactionally
protect assignment changes. - Define whether cancelled/rejected
assignments release quantities and when. - Snapshot partner payable rate
and terms at assignment creation/acceptance according to a documented
rule. - Reassignment must cancel/release the previous assignment in an
auditable sequence. - Test simultaneous assignments and reassignment
failures.

### 11. Garment counts and item identity need an explicit pilot rule

**Gap:** An order line with quantity 10 is not the same as ten
individually identified garments. Bag-level QR custody cannot prove
which exact garment is missing.

**Requirement:** - For the pilot, explicitly choose bag-level tracking
with count/service/condition evidence, or per-garment identifiers for
selected high-risk garments. - Record counts at pickup, partner receipt,
partner dispatch and return handover where operationally feasible. -
Define discrepancy ownership, photo requirements, customer approval and
exception handling. - Do not claim item-level traceability if only bags
and aggregate counts are tracked.

### 12. Uploads and photos can leak private data

**Requirement:** - Private storage only; signed URLs expire. - Validate
file size and file content, not just the supplied MIME type. - Randomize
storage keys and strip unnecessary metadata where feasible. - Limit who
can view/download evidence and log access where appropriate. - Define
retention and deletion policy for photos and customer data. - Never put
permanent public object URLs into order responses.

### 13. Notifications and external side effects can be lost or duplicated

**Gap:** A process can commit an order and crash before sending a
message, or retry and send duplicate notifications.

**Requirement:** - For the pilot, make notification failure visible and
retryable. - Before relying on automated messages, add a notification
outbox or equivalent durable job record written with the business
change. - Use provider message IDs/idempotency where supported. - Verify
WhatsApp webhook signatures and deduplicate inbound events before
accepting automated bookings. - Never let notification failure roll back
a completed handover or payment.

### 14. Cancellation, refunds, disputes and partner claims need explicit policies

**Requirement:** - Define cancellation by order stage and whether
pickup, processing or delivery costs are chargeable. - Refund decisions
are authorized and auditable. - Quality cases have status, evidence,
owner, deadline/SLA, resolution and financial adjustment references. -
Keep claims open independently of delivery completion. - Have a
qualified local lawyer review customer terms, partner terms, privacy and
loss/damage policy before production.

### 15. Backups, secrets and recovery

**Requirement:** - Use separate production/staging credentials and
least-privilege database users. - Restrict database network access where
supported. - Configure automated backups and test restoration before
real orders. - Document rollback and recovery procedures. - Ensure logs
redact sessions, OTPs, payment credentials, tokens and unnecessary
PII. - Do not run destructive migrations or production data changes
without explicit approval.

## P2 --- Future hardening

-   Add an outbox/worker mechanism if reliable notifications and
    integration volume justify it.
-   Add reconciliation reports for payment and partner payable balances.
-   Add retention jobs and auditable data deletion/anonymization.
-   Add stronger operational alerts for orders stuck in a state.
-   Add geospatial routing, automated partner selection or a marketplace
    only after pilot metrics justify the complexity.

## Required implementation order

1.  Foundation, logging, configuration and tests.
2.  Authentication and object-level authorization.
3.  Money utility, price selection and quote protocol.
4.  Atomic slot reservation and order creation/idempotency.
5.  Explicit state transitions and audit records.
6.  Partner assignment quantity concurrency.
7.  Payment ledger/COD reconciliation before real payments.
8.  Custody replay protection before physical handovers.
9.  Upload privacy, operational recovery and production readiness.

## Claude Code instruction

Before implementing a milestone, compare the planned code against this
register. Call out any safeguard that is missing or not testable. Do not
mark a P0 item complete without tests proving the invariant. Update this
register when a risk is resolved, accepted with a documented reason, or
deferred by explicit user decision.
