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
-   Zone model and basic availability checks.
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
-   Cancellation rules.
-   Idempotent creation and optimistic concurrency.
-   Tests for invalid totals, stale quote approvals, unauthorized order
    access and duplicate requests.

Acceptance: - An order can be created, quoted, confirmed and retrieved
with correct snapshots. - Client-supplied totals never control the
stored total. - Concurrent edits do not silently overwrite each other.

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

## Milestone 7 --- Partner processing and QR custody

-   Bag model and random QR identifiers.
-   Handover event model.
-   Scan endpoint and transition validation.
-   Partner intake/count/discrepancy workflow.
-   Processing status workflow.
-   Evidence photo upload flow with private storage.
-   Audit and exception paths.

Acceptance: - Unauthorized and out-of-order scans are rejected. -
Duplicate scans do not duplicate a handover. - History remains
traceable.

## Milestone 8 --- Rider delivery and payments

-   Delivery task model and assignment.
-   Rider task list and task completion.
-   Pickup and return delivery workflows.
-   COD collection and reconciliation.
-   bKash/Nagad manual payment records and authorized verification.
-   Refund and quality-case workflows.
-   Tests for failed delivery, partial payments, duplicate confirmations
    and refunds.

Acceptance: - Delivery evidence and collection records are traceable. -
Unverified mobile payments do not mark an order paid. - Failed delivery
and quality cases do not corrupt order history.

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
can locate an order's bag/custody history and payment status. - No
critical authorization or money-calculation defect remains open.

## Working agreement for Claude Code

For each milestone: 1. Inspect the repository and relevant docs. 2.
State a short implementation plan. 3. Implement only the milestone. 4.
Add tests. 5. Run checks and report exact outcomes. 6. Update docs and
environment examples. 7. Summarize files changed and unresolved
questions.

Do not start the next milestone automatically unless the user asks.
