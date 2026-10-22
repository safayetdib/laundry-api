# 05 --- Implementation Roadmap

Work in small milestones. Finish and verify each milestone before
starting the next. Dates are estimates, not commitments.

## Milestone 0 --- Repository inspection and project setup

-   Inspect the repository and existing git state.
-   Confirm package manager and Node.js version.
-   Add TypeScript configuration and scripts.
-   Add lint/format/test tools appropriate to the chosen stack.
-   Add `.gitignore`, `.env.example` and README.
-   Set up CI for lint, typecheck and tests.
-   Do not add product modules yet.

Acceptance: - Clean install works. - Development server starts. -
Lint/typecheck/test scripts run. - No secrets are committed.

## Milestone 1 --- API foundation

-   Express app and separate server entry point.
-   Validated environment configuration.
-   MongoDB connection lifecycle and health/readiness endpoints.
-   Request ID middleware and structured logs.
-   Centralized errors and 404 handler.
-   Zod validation middleware.
-   OpenAPI skeleton.
-   Unit tests for shared utilities and integration tests for
    health/error behavior.

Acceptance: - Invalid configuration fails clearly at startup. - API does
not leak stack traces. - Tests run against an isolated test database or
suitable test setup. - Shutdown closes server and database gracefully.

## Milestone 2 --- Authentication and authorization

-   Select and document session strategy.
-   User model and session lifecycle.
-   Login/logout/current-user endpoints.
-   Role authorization and partner scope middleware.
-   Rate limiting and security headers.
-   Tests for unauthenticated access, wrong role, wrong partner and
    suspended user.

Acceptance: - Every protected route denies access by default. - Partner
scope cannot be overridden via request payload. - Logout/revocation
invalidates the session as designed.

## Milestone 3 --- Catalogue, zones and pricing

-   Service model and public listing.
-   Zone model with slot configuration (window durations, cutoffs,
    capacity) and availability checks returning selectable windows.
-   Customer and partner price-list models.
-   Draft/publish/version behavior.
-   Server-side money and quote calculation utility.
-   Audit logging for price publication.
-   Tests for price selection, rounding, missing rates, inactive
    services and effective dates.

Acceptance: - Price changes do not change old order snapshots. -
Customer price and partner cost cannot be confused. - Ambiguous price
selection is rejected rather than guessed.

## Milestone 4 --- Orders and quote approval

-   Order and line-item models.
-   Server-side quote creation.
-   Public order code generation.
-   Customer booking and authorized order retrieval.
-   Quote version and approval flow.
-   Atomic pickup/delivery slot reservation against configured capacity,
    with reservation expiry and release on cancellation.
-   Cancellation rules.
-   Idempotent creation and optimistic concurrency.
-   Tests for invalid totals, stale quote approvals, unauthorized order
    access, duplicate requests and concurrent booking at the last
    available slot.

Acceptance: - An order can be created, quoted, confirmed and retrieved
with correct snapshots. - Client-supplied totals never control the
stored total. - Concurrent edits do not silently overwrite each other. -
Slot capacity cannot be oversold by concurrent bookings.

## Milestone 5 --- Partners and assignments

-   Partner model and admin management.
-   Partner service/zone capabilities.
-   Assignment model and manual assignment endpoint.
-   Partner-scoped assignment list.
-   Assignment acceptance and state transitions.
-   Quantity-allocation validation.
-   Audit logs for reassignment and overrides.

Acceptance: - Admin can assign a confirmed order to the pilot partner. -
Partner staff see only their authorized assignments. - Assigned
quantities cannot exceed confirmed order quantities. - The schema
supports multiple assignments for one order.

## Milestone 6 --- Web customer and admin workflows

-   API client and typed request/response models.
-   Login and session UX.
-   Customer service/pricing pages.
-   Address and booking flow.
-   Quote/confirmation display.
-   Admin order queue and order detail.
-   Partner management and assignment screens.
-   Loading, empty, error and permission-denied states.
-   Responsive accessibility and end-to-end tests.

Acceptance: - A test customer can book and an admin can assign without
database editing. - UI totals match API quote responses. - Protected
screens and API endpoints enforce access independently.

## Milestone 7 --- Partner processing and handovers (manual-first)

-   Handover event model anchored to the order/task (not a bag).
-   Manual pickup/intake/collection/delivery confirmation with service
    selection, count, condition notes and transition validation.
-   Partner intake/count/discrepancy workflow that preserves both the
    pickup count and the partner-received count.
-   Processing status workflow.
-   Evidence photo upload flow with private storage.
-   Audit and exception paths.
-   Optional scan assist only if justified: a replaceable scan-resolution
    component that preselects a service and falls back to manual entry on
    unknown/invalid codes; it never bypasses validation. Unique bag
    tracking and a bag model stay deferred unless pilot evidence justifies
    them.

Acceptance: - Every handover can be completed manually, with no scanning. -
If scanning is enabled, unauthorized, out-of-order and replayed scans are
rejected and duplicate scans do not duplicate a handover. - The pickup and
partner-received counts are both retained. - History remains traceable.

## Milestone 8 --- Rider routing, delivery and payments

-   Delivery task model and assignment.
-   Route manifest model with ordered stops (pickup/delivery/partner
    stops), manual operator arrangement for the pilot, and stop-level
    status and failure reasons. Hybrid routes (deliver, collect, drop at
    partner) are allowed.
-   Rider manifest/task list and manual stop/task completion (no scanning
    required).
-   Pickup and return delivery workflows on scheduled windows.
-   COD collection and reconciliation.
-   bKash/Nagad manual payment records and authorized verification.
-   Refund and quality-case workflows.
-   Tests for failed delivery, partial payments, duplicate confirmations,
    refunds and manifest stop transitions.

Acceptance: - A rider can complete a manifest's stops manually. - Delivery
evidence and collection records are traceable. - Unverified mobile payments
do not mark an order paid. - Failed delivery and quality cases do not
corrupt order history. - No automatic route optimization or live GPS is
required; the data model can support them later without redesign.

## Milestone 9 --- Pilot readiness

-   Staging environment and deployment pipeline.
-   Backup and restore rehearsal.
-   Monitoring and error reporting.
-   Rate limits and upload constraints.
-   Staff/partner training.
-   Manual fallback procedures.
-   End-to-end scenario testing.
-   Daily pilot metrics and incident review process.

Acceptance: - Normal and exception flows have been tested. - Operators
can locate an order's handover/custody history and payment status. - No
critical authorization or money-calculation defect remains open.

## Working agreement for Claude Code

For each milestone: 1. Inspect the repository and relevant docs. 2.
State a short implementation plan. 3. Implement only the milestone. 4.
Add tests. 5. Run checks and report exact outcomes. 6. Update docs and
environment examples. 7. Summarize files changed and unresolved
questions.

Do not start the next milestone automatically unless the user asks.
