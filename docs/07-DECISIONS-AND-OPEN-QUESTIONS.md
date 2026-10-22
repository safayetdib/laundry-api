# 07 --- Decisions and Open Questions

## Decisions already made

  -----------------------------------------------------------------------
  Topic                               Decision
  ----------------------------------- -----------------------------------
  Business model                      Managed Folded service, not
                                      marketplace at launch

  Launch city                         Chattogram

  Pilot partner count                 One laundry first

  Repository strategy                 Separate repositories

  Customer experience                 Responsive web first

  Backend                             Separate Express API

  Authentication                      Shared backend
                                      identity/authentication

  Database                            MongoDB/Mongoose

  Customer pricing                    Per-item initially

  Payment methods                     COD, bKash, Nagad

  Mobile payment verification         Manual at first is acceptable

  Custody                             QR-identified bags and append-only
                                      handover history

  Partner expansion                   Data model supports multiple
                                      assignments/partners

  Currency                            BDT with integer minor units

  API                                 Versioned REST API, OpenAPI

  Infrastructure                      Managed services, modular monolith
  -----------------------------------------------------------------------

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

## Do not guess

Claude Code must not invent: - Actual service prices or partner rates. -
Legal/tax rules. - Payment-provider credentials or integration
capabilities. - Partner contract terms. - Confirmed availability of
third-party services. - Production hostnames or secrets. - Success of a
deployment, test or payment unless actually verified.

When an open question blocks implementation, choose a safe local
development default only if it is reversible and clearly documented.
Otherwise ask the user.
