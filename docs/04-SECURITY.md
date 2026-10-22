# 04 --- Security Requirements

## Authentication

-   One central identity system across Folded web interfaces.
-   Prefer secure, HttpOnly cookies for browser sessions.
-   Use Secure cookies in production and an appropriate SameSite policy.
-   If using cookies for state-changing requests, implement appropriate
    CSRF protections.
-   Verify session validity and revocation on the API.
-   Use short-lived credentials or server-managed sessions with rotation
    and revocation.
-   Do not store plaintext passwords or OTPs.
-   Phone verification is not the same as authorization.
-   Mobile clients added later may need a distinct token/session
    strategy, but must use the same identity and permission rules.

## Authorization

-   Check role and resource scope on every request.
-   Customers access only their own records.
-   Partner staff access only their partner's assignments and the
    minimum required customer information.
-   Riders access only assigned tasks and necessary contact/address
    details.
-   Support access is limited to support functions.
-   Administrative overrides require explicit permissions and audit
    logs.
-   A URL guard or hidden UI control is not authorization.

## Input and output

-   Validate body, query and path parameters.
-   Use allowlisted fields for create/update operations.
-   Avoid mass assignment from request bodies into Mongoose documents.
-   Return explicit DTOs, not raw database objects.
-   Prevent NoSQL operator injection by validating expected
    primitive/object shapes.
-   Set request body and upload limits.

## Payments and money

-   Calculate totals server-side.
-   Never trust client-supplied amount, currency, discount or payment
    status.
-   Keep customer charge and partner payable records separate.
-   Manually entered bKash/Nagad payments remain pending until
    authorized verification.
-   Never request or store customer PINs or OTPs.
-   Use provider webhooks only after signature verification and
    replay/duplicate handling have been implemented.
-   Refunds and adjustments must be auditable.
-   Do not describe a payment as verified unless the verification action
    succeeded.

## Handover, custody and evidence

-   These rules apply to every handover, whether recorded manually or with
    an optional scan assist. Scanning is never required and a scan alone is
    never proof of a handover.
-   Validate the actor, order/task and expected state before recording a
    handover. Validate bag identity only when bag tracking is enabled.
-   Record event actor, parties, timestamp, count/discrepancy and
    evidence references where applicable.
-   Do not edit old handover events; append corrections or exception
    records.
-   Store evidence photos privately with short-lived signed access URLs.
-   Apply upload type/size limits and validate file content where
    feasible.

### If scanning is enabled

-   QR/sticker codes are random, non-sequential and contain no personal
    information, business rules or authorization; a code is an identifier
    only, never a bearer or authorization token.
-   A service sticker may preselect a service; it does not identify an
    individual bag unless explicitly registered for that purpose.
-   Resolve codes through the replaceable scan-resolution component; unknown,
    invalid, disabled or unsupported codes fail safely and fall back to
    manual entry.
-   Protect against scan replay and out-of-order scans with expected-state
    checks and idempotency keys.

## Infrastructure

-   Keep secrets in deployment secret stores or environment variables.
-   Commit only placeholder values in `.env.example`.
-   Use separate development, staging and production
    credentials/databases.
-   Restrict database access using least privilege and network controls
    where supported.
-   Enable database backups and periodically test restoration.
-   Use HTTPS.
-   Configure CORS with exact trusted origins; never combine
    credentialed requests with wildcard origins.
-   Rate-limit login, OTP, booking, tracking, uploads and payment
    operations.
-   Use structured logs but redact tokens, OTPs, payment credentials and
    unnecessary personal data.
-   Set secure HTTP headers and appropriate request timeouts.
-   Add dependency scanning and update vulnerable dependencies promptly.

## Privacy and operations

-   Share only necessary customer information with partners and riders.
-   Define photo and personal-data retention before launch.
-   Maintain a process for customer complaints, data access and deletion
    requests consistent with applicable law.
-   Have a qualified Bangladesh lawyer review privacy notices, terms,
    partner agreements, taxes and loss/damage handling.
-   Never run destructive production actions or migrations without
    explicit approval.
