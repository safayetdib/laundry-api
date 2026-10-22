# 02 --- Domain Model

## Collections

Initial collections: - `users` - `sessions` (if using server-side
sessions) - `addresses` - `serviceZones` - `services` - `priceLists` -
`orders` - `partners` - `partnerOrderAssignments` - `bags` -
`handoverEvents` - `deliveryTasks` - `payments` - `qualityCases` -
`auditLogs`

Optional later: - `subscriptions` - `notificationOutbox` -
`webhookEvents` - `settlements` - `inventory` - `routePlans`

Do not create every optional collection before a use case exists.

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
locality/postal-code or geospatial coverage, slot configuration,
timestamps.

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

### Bag

`_id`, random unique QR token/identifier, `orderId`, seal status,
current custody reference, created timestamp. QR values must not reveal
customer data and must not authorize access.

### HandoverEvent

`_id`, bag/order IDs, event type, from/to parties, actor user, time
occurred, time recorded, optional item count, discrepancy and evidence
keys, request ID. Append events; do not edit past events to correct
mistakes.

### DeliveryTask

`_id`, order ID, task type (`pickup`, `return_delivery`), assigned
rider, status, scheduled window, attempts, proof/evidence references,
COD amount collected, timestamps.

### Payment

`_id`, order ID, payment method, event type, amount, currency, status,
provider/reference where applicable, recorded/verified by, timestamps.
Refunds and corrections should be traceable events rather than silent
overwrites.

### QualityCase

`_id`, order ID, relevant item/bag/assignment references, type
(`missing`, `damage`, `rework`, `complaint`, `other`), status, evidence,
investigation notes, resolution and timestamps.

### AuditLog

`_id`, actor, action, resource type/ID, request ID, safe change summary
and timestamp. Do not log credentials or sensitive tokens.

## Relationships

-   User → many Orders.
-   Order → many Order items.
-   Order → many PartnerOrderAssignments.
-   Partner → many PartnerOrderAssignments.
-   Order → many Bags.
-   Bag → many HandoverEvents.
-   Order → many DeliveryTasks.
-   Order → many Payment records.
-   Order → many QualityCases.
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
6.  Custody transitions must match the expected bag/order state and
    actor permission.
7.  Completed financial records and custody events are not silently
    overwritten.
8.  Historical order price snapshots are stable after confirmation
    except through an explicit quote revision.
9.  Every privileged override has an audit record.
10. Duplicate requests must not create duplicate orders, collections or
    state transitions.
