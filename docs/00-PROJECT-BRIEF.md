# 00 --- Project Brief

## What Folded is

Folded is a branded, managed laundry pickup-and-delivery service
launching in Chattogram, Bangladesh. Customers book with Folded. Folded
controls the customer experience, service catalogue, customer prices,
pickup and delivery coordination, payment records, support and complaint
handling. A partner laundry performs approved processing work.

This is not a customer-facing marketplace in the initial release.

## Launch assumptions

-   City: Chattogram.
-   Pilot: one verified partner laundry first.
-   Service area: start with a small number of adjacent zones; keep
    zones configurable.
-   Customer pricing: per item initially.
-   Services: wash & fold, wash & iron, iron only; dry cleaning and
    specialist items only if the partner is qualified and
    rates/processes are verified.
-   Channels: responsive website, operations-entered WhatsApp/phone
    bookings; WhatsApp integration can come later.
-   Delivery: Folded-managed and/or third-party riders, with explicit
    task and handover tracking.
-   Scheduling: configurable pickup and delivery windows with booking
    cutoffs and capacity limits; an operations-managed route manifest with
    ordered stops. No unrestricted random assignments, and no automatic
    route optimization or live GPS for the pilot.
-   Identification: QR/sticker scanning is optional throughout. Physical
    bag type is not fixed and must not constrain the software.
-   Payments: COD, bKash and Nagad. Manual mobile-payment verification
    is acceptable in the pilot.
-   Currency: BDT, represented in integer minor units (poisha).
-   Customer mobile app: defer; responsive web first.
-   Future: more partners and zones, and possibly a marketplace or owned
    facility if validated by economics.

## Main workflow

### A. Customer booking

1.  Customer or Folded operator selects the service(s) and provides an
    address.
2.  The system presents available pickup windows and an expected delivery
    window, and calculates an estimate from the applicable customer price
    list.
3.  Booking capacity is protected so concurrent bookings cannot exceed the
    configured slot limit.
4.  The customer may optionally prepare and label bags in advance; this is
    never required.

### B. Rider pickup

5.  The rider sees assigned stops in the route manifest and selects the
    correct order and service manually, or optionally scans a code to
    preselect the service.
6.  The rider confirms the service, garment count, relevant visible
    condition notes and supporting photos where needed.
7.  The system records actor, timestamp, order/task, count and any
    discrepancies, and the rider confirms the pickup handover. A scan alone
    is never proof of pickup.

### C. Partner intake

8.  The rider transports the collected garments to the assigned partner.
9.  Partner staff check received garments against the recorded
    pickup/service counts, confirm receipt and record the actual received
    quantities. The original pickup count and the partner-received count
    are both preserved; neither silently overwrites the other.
10. Count mismatches, missing garments, damage or service disagreements are
    recorded as discrepancies. Policy defines which discrepancies block
    processing and which require customer approval or operational review.

### D. Processing

11. The partner updates processing status. Any revised quote follows an
    explicit customer-approval workflow before chargeable additional work
    proceeds.
12. The partner marks the work completed and ready for collection, and
    Folded notifies the customer at appropriate milestones.

### E. Rider collection and customer delivery

13. Completed orders are assigned to a scheduled collection/delivery route;
    the rider confirms collection from the partner.
14. The rider delivers the garments and records delivery confirmation. COD
    collection, mobile-payment verification, failed delivery and
    reconciliation are recorded separately from delivery status.
15. Clean garments are kept physically separate from incoming dirty
    garments during transport. Folded reconciles payment and handles any
    quality case; a route may combine deliveries and pickups when
    practical.

Exception paths (failed pickup, customer unavailable, quote awaiting
approval, partner rejection, rework, cancelled-after-pickup, failed
delivery, return-to-partner, partial fulfillment) are defined in the domain
model's state machines.

## Business principles

-   One accountable Folded brand.
-   Customer price and partner payable cost are separate.
-   Customer-facing prices must be transparent; no unapproved paid
    add-ons.
-   Partner assignments are separate from orders so one order can later
    use multiple partners.
-   Handover/custody history is append-only.
-   Scanning is optional; a scan alone never proves a handover. The API
    validates actor, expected state and confirmation whether the action is
    manual or scan-assisted.
-   Clean (processed) garments are kept physically separate from incoming
    dirty garments during transport.
-   Order state, assignment state, delivery-task state and payment state
    are separate.
-   Complaints may remain open after delivery.
-   Do not store bale inventory details; they are not part of the
    customer platform.

## MVP must include

-   Authentication and role-based access.
-   Service catalogue, customer pricing, partner rates and zones.
-   Customer booking and order management.
-   Admin operations and manual partner assignment.
-   Partner intake and processing workflow.
-   Handover/processing event log (manual-first; optional QR/sticker scan
    assist). No bag-registration or unique bag-tracking system in the
    pilot.
-   Scheduled pickup/delivery windows with capacity limits and an
    operations-managed route manifest with ordered stops.
-   Responsive rider task workflow with manual service selection.
-   COD and manually verified bKash/Nagad records.
-   Delivery confirmation.
-   Quality cases, rework and refund records.
-   Basic operational and contribution-margin reporting.
-   Audit logs and backup/restore procedure.

## Defer

-   Native mobile apps.
-   Customer-facing marketplace.
-   Automated partner matching/ranking.
-   Automatic route optimization, live GPS tracking and advanced dispatch
    algorithms (manual route manifests for the pilot).
-   Unique bag tracking, a bag collection and bag-registration workflows
    (add only when pilot evidence justifies them).
-   AI garment recognition.
-   Automated partner payouts.
-   Loyalty engine and complex subscription plans.
-   Owning a laundry facility.
-   Microservices and event-broker infrastructure.

## Product terminology

-   **Order:** customer-facing service request managed by Folded.
-   **Order item:** garment/service line with quantity and customer
    price snapshot.
-   **Partner assignment:** work assigned to a particular laundry,
    including assigned quantities and partner payable cost.
-   **Order service item:** a service line on an order with quantity,
    customer price snapshot and recorded counts.
-   **Processing record:** partner-side record of intake counts, processing
    status and completion for an assignment.
-   **Bag:** optional physical container. Bag identity is optional metadata
    on an order/handover, not a required entity; it is only individually
    tracked if explicitly registered for that purpose.
-   **Handover event:** immutable record of a custody transfer or exception
    (pickup, intake, collection, delivery), created manually or with an
    optional scan assist.
-   **Delivery task:** rider work item for pickup or return delivery,
    scheduled into a route manifest.
-   **Route manifest:** an operations-managed, ordered list of rider stops
    (pickup and/or delivery) for a window.
-   **Payment record:** a collection, verification, refund or adjustment
    event.
-   **Quality case:** complaint, damage/loss investigation, rework or
    resolution.
