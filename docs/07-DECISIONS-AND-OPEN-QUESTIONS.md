# 07 --- Decisions and Open Questions

## Decisions already made

| Topic | Decision |
| --- | --- |
| Business model | Managed Folded service, not marketplace at launch |
| Launch city | Chattogram |
| Pilot partner count | One laundry first |
| Repository strategy | Separate repositories (`laundry-api`, `laundry-web`) |
| Customer experience | Responsive web first |
| Backend | Separate Express API |
| Authentication | Shared backend identity/authentication |
| Database | MongoDB/Mongoose |
| Customer pricing | Per-item initially |
| Payment methods | COD, bKash, Nagad |
| Mobile payment verification | Manual at first is acceptable |
| Scanning | Optional; every core workflow works without it. Codes may preselect a service and never carry authorization |
| Bag identity | Optional metadata only; no bag collection or registration in the pilot |
| Custody | Manual-first handovers with append-only handover/processing history |
| Scheduling | Configurable pickup/delivery windows with capacity limits and booking cutoffs |
| Routing | Operations-managed manual route manifest for the pilot; no auto-routing or live GPS |
| Partner expansion | Data model supports multiple assignments/partners |
| Currency | BDT with integer minor units |
| API | Versioned REST API, OpenAPI |
| Infrastructure | Managed services, modular monolith |

## Decisions that must be confirmed before production

1.  Authentication provider/implementation and login method: phone OTP,
    email/password, or another method.
2.  Session implementation, cookie domain and exact production
    hostnames.
3.  Exact pilot zones and serviceable address validation.
4.  Pickup slot duration, capacity and cutoff times.
5.  Customer catalogue, garment codes and customer prices.
6.  Partner wholesale rate card and settlement schedule.
7.  Delivery pricing, cancellation fees and failed-attempt policy.
8.  Quote approval policy and what happens if the customer does not
    respond.
9.  Tax/invoice treatment and final financial rounding rules.
10. bKash/Nagad proof requirements and who can verify payments.
11. COD handling, rider cash reconciliation and shortage process.
12. Loss/damage investigation, compensation limits and complaint
    deadlines.
13. Photo/data retention and privacy policy.
14. Production hosting and backup plan.
15. Whether customer order tracking uses login, OTP or secure expiring
    links.
16. Exact pickup/delivery window durations, booking cutoffs and per-zone
    capacity limits.
17. Which intake discrepancies block processing, which require customer
    approval, and which need only operational review.
18. Whether any scan assist (service stickers, bag codes) is enabled for the
    pilot, and which bag approach is used — noting core workflows must work
    without it either way.
19. Rider assignment rules and vehicle/bag capacity inputs for the route
    manifest.

## Do not guess

Claude Code must not invent: - Actual service prices or partner rates. -
Legal/tax rules. - Payment-provider credentials or integration
capabilities. - Partner contract terms. - Confirmed availability of
third-party services. - Production hostnames or secrets. - Success of a
deployment, test or payment unless actually verified.

When an open question blocks implementation, choose a safe local
development default only if it is reversible and clearly documented.
Otherwise ask the user.
