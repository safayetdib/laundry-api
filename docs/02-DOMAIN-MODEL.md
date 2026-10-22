# 02 --- Domain Model

## Collections

Initial collections: - `users` - `sessions` (if using server-side
sessions) - `addresses` - `serviceZones` - `services` - `priceLists` -
`slotReservations` - `orders` - `partners` - `partnerOrderAssignments` -
`processingRecords` - `handoverEvents` - `routeManifests` (with embedded or
referenced stops) - `deliveryTasks` - `payments` - `qualityCases` -
`idempotencyRecords` - `auditLogs`

Optional later: - `bags` (only when individual bag tracking is justified) -
`subscriptions` - `notificationOutbox` - `webhookEvents` - `settlements` -
`inventory`

`bags` is deliberately not an initial collection. The core domain is
orders, order service items, operational tasks, handover events and
processing records; bag identity is optional metadata enabled later. Do not
create every optional collection before a use case exists.

## User and partner scope

A user can have one or more roles. Partner staff must have an authorized
`partnerId` scope. A rider can access assigned tasks and the minimum
information needed to complete them. A role name alone must never grant
access to all records.

Suggested roles: - `customer` - `admin` - `operations` -
`partner_staff` - `rider` - `support`

## Money

-   Use integer minor units, never floating-point arithmetic for money.
-   BDT ৳100.50 is stored as `10050`.
-   Store currency explicitly on financial records.
-   Define rounding rules in a shared money utility.
-   Calculate prices on the server.
-   Preserve the applied price-list ID/version and unit price in each
    order line.
-   Customer charges and partner payable costs are separate.
-   Do not recalculate old orders from current prices.

## Suggested model fields

### User

`_id`, `name`, normalized `phone`, optional normalized `email`, `roles`,
`status`, optional `partnerId`, verification timestamps, created/updated
timestamps.

### Partner

`_id`, unique `code`, `name`, `status`, supported service IDs, zone IDs,
contact information, timestamps.

### Service

`_id`, unique `code`, `name`, description, `pricingUnit` (`item`, `kg`,
`order`), active/inactive status, sort order.

### ServiceZone

`_id`, unique `code`, `name`, city, active/inactive status,
locality/postal-code or geospatial coverage, slot configuration (window
durations, cutoffs, default capacity), timestamps.

### SlotReservation

`_id`, `zoneId`, slot type (`pickup`, `delivery`), start/end window,
capacity, reserved count, status, optional `orderId`, reservation expiry
for unconfirmed bookings, created/updated timestamps. Capacity is reserved
atomically; a frontend availability check is not sufficient. Capacity is
released on valid cancellation or expiry.

### PriceList

`_id`, `kind` (`customer` or `partner`), name, optional partner scope,
optional zone scope, currency, version, status, effective dates,
entries, creator and creation time. Publish a new version instead of
mutating historical rates.

### Order

`_id`, unique public `orderCode`, `customerId`, `status`, currency,
address snapshot, `zoneId`, item snapshots, subtotal, delivery fee,
discount, tax, total, quote version/approval, pickup window and
timestamps.

Order line snapshot fields: order-item ID, service ID, garment code,
display name, quantity, unit amount, line amount, customer price-list
ID/version, optional condition notes.

### PartnerOrderAssignment

`_id`, `orderId`, `partnerId`, status, assigned order-item quantities,
payable amount, currency, partner price-list ID/version, timestamps for
acceptance/receipt/completion.

### ProcessingRecord

`_id`, `assignmentId`, `orderId`, received quantities per order service
item, processing status, discrepancy references, completion/ready
timestamps. The partner-received count is preserved alongside the original
pickup count; neither silently overwrites the other.

### RouteManifest

`_id`, date, window reference, `riderId`, vehicle/bag capacity inputs,
status, ordered list of stops and timestamps. For the pilot an operator
arranges stop order manually. Hybrid manifests may mix pickup and delivery
stops.

### RouteStop

Belongs to a manifest (embedded or referenced): `_id`, sequence index, stop
type (`pickup`, `delivery`, `partner_dropoff`, `partner_collection`),
`orderId`/`deliveryTaskId`, address snapshot, status, failure reason,
arrival/completion timestamps. Keep stops as first-class, data-driven
records so automated routing can set stop order later without a redesign.

### Bag (optional, only when individual bag tracking is enabled)

Not a pilot entity. When justified: `_id`, random opaque identifier,
`orderId`, optional registration/seal status, created timestamp. A bag
identifier carries no customer data, business rules or authorization, and a
service sticker does not identify a bag unless explicitly registered for
that purpose.

### HandoverEvent

`_id`, `orderId`, optional `deliveryTaskId`/`assignmentId`, optional
`bagId` (only if bag tracking is enabled), event type (`pickup`, `intake`,
`collection`, `delivery`, correction/exception), from/to parties, actor
user, time occurred, time recorded, optional item count, discrepancy and
evidence keys, scan-assisted flag, request ID. The event is anchored to the
order/task, not to a bag. Append events; do not edit past events to correct
mistakes.

### DeliveryTask

`_id`, order ID, task type (`pickup`, `return_delivery`), assigned
rider, optional `manifestId`/stop reference, status, scheduled window,
attempts, failure reason, proof/evidence references, COD amount collected,
timestamps.

### Payment

`_id`, order ID, payment method, event type, amount, currency, status,
provider/reference where applicable, recorded/verified by, timestamps.
Refunds and corrections should be traceable events rather than silent
overwrites.

### QualityCase

`_id`, order ID, relevant item/assignment references (and bag only if bag
tracking is enabled), type
(`missing`, `damage`, `rework`, `complaint`, `other`), status, evidence,
investigation notes, resolution and timestamps.

### AuditLog

`_id`, actor, action, resource type/ID, request ID, safe change summary
and timestamp. Do not log credentials or sensitive tokens.

## Relationships

-   User → many Orders.
-   Order → many Order service items.
-   Order → many PartnerOrderAssignments.
-   Partner → many PartnerOrderAssignments.
-   PartnerOrderAssignment → one ProcessingRecord.
-   Order → many HandoverEvents.
-   RouteManifest → many RouteStops.
-   RouteStop → one DeliveryTask (pickup or delivery).
-   Order → many DeliveryTasks.
-   Order → many Payment records.
-   Order → many QualityCases.
-   (Optional) Order → many Bags; Bag → many HandoverEvents — only when bag
    tracking is enabled.
-   User → many AuditLogs.

## State models

### Order

`pending_confirmation` → `confirmed` → `pickup_scheduled` → `picked_up`
→ `in_service` → `ready_for_delivery` → `out_for_delivery` →
`delivered`.

`cancelled` is allowed only from explicitly permitted states under the
cancellation policy. Exceptional delivery attempts and quality cases are
separate workflows.

### Partner assignment

`assigned` → `accepted` → `received` → `processing` →
`ready_for_collection` → `dispatched` → `completed`.

Define whether any intermediate state can be skipped or retried. Only
authorized operations may reassign work, and changes must be audited.

### Payment

Track payment records separately from the aggregate order payment
status. Support unpaid, pending verification, partial payment, paid,
pending refund, partial refund and refunded states as derived/validated
outcomes.

### Delivery task and route stop

Delivery task: `scheduled` → `en_route` → `arrived` →
`completed`; or `failed` (with a recorded failure reason) →
`rescheduled`. Route stop status mirrors its task and records sequence,
arrival and failure reason. A manifest is `draft` → `assigned` →
`in_progress` → `completed`, and an operator may reorder stops while the
manifest is `draft`.

### Slot reservation

`held` (awaiting booking confirmation, with expiry) → `confirmed`; or
`expired`/`released` on timeout or valid cancellation, which returns
capacity.

## Invariants

1.  An order's total equals the sum of validated line amounts and
    permitted fees/discounts/taxes under the documented calculation
    rule.
2.  A customer cannot approve an outdated quote version.
3.  Assigned quantities cannot exceed confirmed order-item quantities.
4.  A partner can only access assignments belonging to its authorized
    partner scope.
5.  A rider can only act on tasks assigned to them or explicitly
    authorized by operations.
6.  Handover transitions must match the expected order/task state and
    actor permission, whether recorded manually or with a scan assist; a
    scan alone is never sufficient.
7.  Completed financial records and handover events are not silently
    overwritten.
8.  Historical order price snapshots are stable after confirmation
    except through an explicit quote revision.
9.  Every privileged override has an audit record.
10. Duplicate requests must not create duplicate orders, collections or
    state transitions.
11. Pickup-slot capacity is reserved atomically; confirmed reservations for
    a slot never exceed its capacity.
12. The original pickup count and the partner-received count are both
    preserved on their respective records; a discrepancy is recorded rather
    than one value overwriting the other.
13. Every core workflow step can be completed with manual service selection
    and manual confirmation; bag identity is never required to record a
    handover.
