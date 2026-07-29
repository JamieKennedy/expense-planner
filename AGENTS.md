# Engineering Guide

## Repository map

- `src/backend/ExpensePlanner.Domain`: entities, money/split invariants, scheduling and
  report calculations. It must not reference Application, Infrastructure or API.
- `src/backend/ExpensePlanner.Application`: deep use-case modules and
  `IExpensePlannerDbContext`. It may reference Domain and EF abstractions, never
  Infrastructure or API.
- `src/backend/ExpensePlanner.Infrastructure`: EF Core/PostgreSQL, Identity, JWT, Redis
  and external holiday data.
- `src/backend/ExpensePlanner.Api`: full controllers, HTTP security and Problem Details.
- `src/backend/ExpensePlanner.Admin`: recovery, migrations and operational commands.
- `src/frontend`: TanStack Start SSR React application.
- `src/orchestration`: Aspire AppHost and shared telemetry/health defaults.
- `tests`: interface, architecture and observable integration tests.

## Commands

```text
dotnet restore ExpensePlanner.slnx --locked-mode
dotnet format ExpensePlanner.slnx --verify-no-changes --no-restore
dotnet build ExpensePlanner.slnx --no-restore
dotnet test ExpensePlanner.slnx --no-build
pnpm --dir src/frontend install --frozen-lockfile
pnpm --dir src/frontend format
pnpm --dir src/frontend lint
pnpm --dir src/frontend typecheck
pnpm --dir src/frontend test
pnpm --dir src/frontend build
docker compose config
```

## Domain invariants

- Money crosses interfaces as integer GBP pence; never use floating point for persisted
  or calculated money.
- Contributor percentages are integer basis points and total exactly 10,000.
- Even-split remainders and penny remainders are assigned deterministically in input
  order so allocations always sum to the source amount.
- Expenses have at least one tag and contributor. One-offs use an exact date; monthly
  expenses use a day from 1–31 and optional legacy-unbounded/start-month anchor; weekly
  expenses repeat every seven days from an exact first-charge anchor. Budget tags are
  unique per template.
- Monthly days are clamped to the nominal month. Monthly and weekly occurrences can then
  advance to the next England/Wales working day. Crossing a month boundary does not
  change occurrence ownership.
- Reports always recalculate from current definitions. Do not introduce snapshots or a
  paid/reconciled state in V1.
- Multi-tag filtering returns distinct expenses. Each tag and matching budget line gets
  the expense’s full value.
- Every planner-owned query must scope on authenticated `PlannerId`. Contributors are
  labels, not login identities.
- PostgreSQL is authoritative. Redis failures must not lose planner data.

## Backend standards

- Prefer one cohesive application module interface per capability. Do not add generic
  repositories, pass-through managers or one-method wrappers around EF.
- Controllers translate HTTP only; business decisions belong in Application or Domain.
- Use async EF APIs with cancellation tokens and project/materialize deliberately.
- Return RFC Problem Details for failures. Authorization is required by default.
- Keep public contracts explicit: UUIDs, pence, basis points and ISO dates/months.
- Treat warnings and analyzers as errors. Use nullable reference types and file-scoped
  namespaces.
- Test module interfaces and observable HTTP behavior, not private implementation details.

## Frontend standards

- Strict TypeScript; no `any`, type assertions only at genuine runtime boundaries.
- TanStack Query owns server state. Zustand is for ephemeral UI state only.
- Use validated URL search parameters for table/report filters.
- Keep API calls in the universal request module so cookies, CSRF and one refresh/retry
  behave consistently.
- Prefer accessible semantic controls and visible keyboard focus. Check responsive and
  empty/error/loading states.
- Generated `src/lib/schema.d.ts` is replaced from OpenAPI; never hand-edit it.

## Migrations and persistence

- Create migrations with the repository-pinned `dotnet-ef` tool.
- Review the migration and generated SQL. Never amend a migration already applied outside
  a disposable local database.
- The API applies pending migrations before it begins serving in every environment.
- Keep migrations backward-compatible with rolling recovery, and never edit one that has
  been applied outside a disposable local database.
- Preserve composite planner indexes and add cross-planner tests for every new aggregate.
- PostgreSQL backups are durable; Redis backups are unnecessary.

## Git and review

- Branch from `staging` using `feature/*`, `bug/*`, `chore/*` or `docs/*`.
- Use Conventional Commit-style PR titles and squash topic PRs.
- Promotion `staging` → `main` and hotfix forward merges preserve merge ancestry.
- Do not commit secrets, generated local certificates, dumps, `.env` files, build output
  or dependency folders.
- A change is complete only after relevant format, analyzer, unit, integration and UI
  checks pass and documentation reflects operational changes.
