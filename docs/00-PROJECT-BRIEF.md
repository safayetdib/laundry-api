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
    task and custody tracking.
-   Payments: COD, bKash and Nagad. Manual mobile-payment verification
    is acceptable in the pilot.
-   Currency: BDT, represented in integer minor units (poisha).
-   Customer mobile app: defer; responsive web first.
-   Future: more partners and zones, and possibly a marketplace or owned
    facility if validated by economics.

## Main workflow

1.  Customer or Folded operator creates a booking.
2.  The API calculates an estimate using the applicable customer price
    list.
3.  Pickup is scheduled and assigned.
4.  Rider verifies the bag and records pickup, count and relevant
    condition evidence.
5.  If count/service changes affect price, Folded gets customer approval
    for the revised quote.
6.  Partner receives the assigned items and records discrepancies.
7.  Partner processes the garments and marks the assignment ready.
8.  Folded authorizes dispatch and arranges return delivery.
9.  Rider records delivery evidence and COD collection, if applicable.
10. Folded reconciles payment and handles any quality case.

## Business principles

-   One accountable Folded brand.
-   Customer price and partner payable cost are separate.
-   Customer-facing prices must be transparent; no unapproved paid
    add-ons.
-   Partner assignments are separate from orders so one order can later
    use multiple partners.
-   Bag custody history is append-only.
-   A QR scan alone does not prove a handover; the API validates actor,
    expected state and confirmation.
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
-   QR bag identity and custody event log.
-   Responsive rider task workflow.
-   COD and manually verified bKash/Nagad records.
-   Delivery confirmation.
-   Quality cases, rework and refund records.
-   Basic operational and contribution-margin reporting.
-   Audit logs and backup/restore procedure.

## Defer

-   Native mobile apps.
-   Customer-facing marketplace.
-   Automated partner matching/ranking.
-   Advanced route optimization/live GPS.
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
-   **Bag:** physical bag identified by a random QR code.
-   **Handover event:** immutable record of custody transfer or
    exception.
-   **Delivery task:** rider work item for pickup or return delivery.
-   **Payment record:** a collection, verification, refund or adjustment
    event.
-   **Quality case:** complaint, damage/loss investigation, rework or
    resolution.
