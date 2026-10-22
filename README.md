# Folded --- Claude Code Handoff Pack

This documentation pack is the source of truth for implementing Folded's
initial software platform.

## How to use it

1.  Create the separate repositories `folded-api`, `folded-web`, and
    optionally `folded-docs`.
2.  Start with the API repository.
3.  Copy `CLAUDE.md` into the root of each code repository. Keep the
    repository-specific addendum relevant to that repo.
4.  Give Claude Code `docs/00-PROJECT-BRIEF.md`,
    `docs/01-ARCHITECTURE.md`, `docs/02-DOMAIN-MODEL.md`,
    `docs/03-API-CONTRACT.md`, `docs/04-SECURITY.md`, and
    `docs/05-ROADMAP.md` as project context.
5.  Ask Claude Code to implement one milestone at a time. Require it to
    inspect the current repository before editing and to run tests/type
    checks after changes.
6.  Commit working milestones separately.

## Recommended first prompt

> Read `CLAUDE.md` and all files in `docs/`. Inspect the current
> repository and report its state before changing anything. Then
> implement only Milestone 1 from `docs/05-ROADMAP.md`. Do not implement
> later milestones, do not invent product requirements, and do not add
> dependencies without explaining why. Add tests and update
> documentation. Run the available checks and report exactly what
> passed, failed, or could not be run.

## Documentation index

-   `CLAUDE.md` --- persistent coding-agent instructions
-   `docs/00-PROJECT-BRIEF.md` --- business and MVP context
-   `docs/01-ARCHITECTURE.md` --- technical architecture and repository
    boundaries
-   `docs/02-DOMAIN-MODEL.md` --- entities, relationships, statuses,
    invariants
-   `docs/03-API-CONTRACT.md` --- API conventions and initial endpoint
    contracts
-   `docs/04-SECURITY.md` --- authentication, authorization and data
    protection
-   `docs/05-ROADMAP.md` --- phased implementation plan and acceptance
    criteria
-   `docs/06-TESTING-AND-OPERATIONS.md` --- testing, deployment, logging
    and backups
-   `docs/07-DECISIONS-AND-OPEN-QUESTIONS.md` --- decisions already made
    and items that need explicit confirmation

## Important

This is a development specification, not legal advice or a final
operational contract. Payment gateway integrations, Bangladesh-specific
legal terms, tax treatment, privacy retention and partner claim policies
must be confirmed before production use. Do not claim a feature is
implemented merely because its documentation exists.
# laundry-api
