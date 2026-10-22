# Folded --- Claude Code Handoff Pack

This documentation pack is the source of truth for implementing Folded's
initial software platform.

## How to use it

1.  Use the separate repositories `laundry-api` (the API) and
    `laundry-web` (the web app); a separate docs repository is optional.
2.  Start with the API repository.
3.  Copy `CLAUDE.md` into the root of each code repository. Keep the
    repository-specific addendum relevant to that repo.
4.  Give Claude Code `CLAUDE.md` and all files under `docs/`
    (`00`–`08`) as project context.
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
-   `docs/08-LOOPHOLE-REVIEW.md` --- design-review risk register (P0/P1/P2
    safeguards) to check before implementing each milestone
-   `docs/09-PILOT-READINESS.md` --- deployment runbook, env vars, backup/
    recovery, monitoring and the go-live checklist

## Development (laundry-api)

Prerequisites: Node.js 20 LTS (see `.nvmrc`) and pnpm (via Corepack:
`corepack enable`).

```bash
pnpm install            # install dependencies
cp .env.example .env    # local configuration (never commit .env)
pnpm dev                # start the dev server with reload (default PORT=3000)
```

### Seeding

`pnpm seed` bootstraps a usable system against the configured `MONGODB_URI`:
the first admin (and optional operations/partner-staff/rider users), the
service catalogue, a pilot zone with slots, the pilot partner, and published
customer/partner price lists. It is idempotent (safe to re-run). Admin
credentials come from `SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD` (required).

> The seed publishes **placeholder** prices/rates so flows work out of the
> box; replace them with the real rate cards before launch.

Checks (all run in CI on every push/PR):

```bash
pnpm lint               # ESLint
pnpm format:check       # Prettier (code only; markdown docs are hand-maintained)
pnpm typecheck          # tsc --noEmit
pnpm test               # Vitest
pnpm build              # compile to dist/
```

Milestone 0 provides only project scaffolding and a placeholder `/health`
route. Product modules are added milestone by milestone per
`docs/05-ROADMAP.md`.

## Important

This is a development specification, not legal advice or a final
operational contract. Payment gateway integrations, Bangladesh-specific
legal terms, tax treatment, privacy retention and partner claim policies
must be confirmed before production use. Do not claim a feature is
implemented merely because its documentation exists.
