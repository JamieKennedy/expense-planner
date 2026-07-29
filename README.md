# Expense Planner

A private, invite-only planner for monthly income, one-off and recurring expenses, and
budgets. Expense Planner projects today’s definitions onto any month; it is deliberately
not a transaction ledger and does not track whether a payment cleared.

## What it does

- Keeps accounts, contributors and coloured tags isolated in each user’s planner.
- Splits each GBP expense by exact integer basis points and allocates penny remainders
  deterministically.
- Clamps days 29–31 in short months and can advance dates over weekends and official
  England/Wales bank holidays.
- Schedules one-off expenses on an exact date, monthly expenses from a starting month,
  and weekly expenses from their first charge date. Existing migrated monthly expenses
  remain historically active.
- Provides monthly income/out/net, contributor, tag and tag-linked budget reports.
- Expands weekly definitions into one row per occurrence and supports server-paginated
  expense filtering by account, contributor and tag.
- Opens one-time first-owner registration on an empty database, then requires invitations
  and a password. Per-user TOTP MFA is recommended and enabled by default, but optional.
  Refresh sessions rotate on every use.

An occurrence with several tags appears once in filtered lists, but its full value belongs
to each individual tag report. Tag totals are therefore intentionally non-additive.

Dashboard, expense, and income month controls select the nominal reporting month.
Working-day adjustment can move a displayed due date into the following month without
moving that occurrence out of its nominal report month. Editing or deleting a definition
recalculates earlier months; the application does not preserve a payment ledger or
immutable historical snapshot.

## Architecture

The backend is a modular monolith. Domain rules have no infrastructure dependencies;
Application exposes cohesive use-case module interfaces and `IExpensePlannerDbContext`;
Infrastructure supplies EF Core, Identity, JWT, Redis and holiday adapters; API contains
full controllers; Admin owns operational commands.

```text
src/
  backend/
    ExpensePlanner.Domain
    ExpensePlanner.Application
    ExpensePlanner.Infrastructure
    ExpensePlanner.Api
    ExpensePlanner.Admin
  frontend/                         TanStack Start SSR application
  orchestration/
    ExpensePlanner.AppHost
    ExpensePlanner.ServiceDefaults
tests/
```

PostgreSQL is authoritative. Redis contains only disposable report, holiday and
short-lived MFA data. Report reads fall back to PostgreSQL when Redis is unavailable.
Every planner-owned row contains `PlannerId`; application queries scope by the
authenticated planner.

## Prerequisites

- .NET SDK 10.0.110 (pinned by `global.json`)
- Docker Desktop or another Docker Engine
- Node.js 24 LTS or newer
- pnpm 11.9
- .NET Aspire workload/tooling supported by the pinned Aspire 13.3 SDK

## Development with Aspire

For the first setup in Rider:

1. Ensure Docker Desktop is running.
2. Open `ExpensePlanner.slnx` and allow Rider to restore NuGet packages.
3. Run the `ExpensePlanner.AppHost: https` launch profile.
4. Open the Aspire dashboard URL shown by Rider.

The AppHost generates the PostgreSQL development password once and stores it in the
AppHost project's .NET user-secrets store. This keeps the password stable across runs
while the named PostgreSQL data volume is retained.

To start the same AppHost from a terminal instead:

```powershell
dotnet restore ExpensePlanner.slnx --locked-mode
pnpm --dir src/frontend install --frozen-lockfile
dotnet run --project src/orchestration/ExpensePlanner.AppHost
```

Aspire starts PostgreSQL 18, Redis 8.2, the API and the frontend. It injects service
discovery connection details. The API applies pending database migrations before it
begins serving. The first run may pull container images.

### Running the Admin CLI with Aspire

Stop the AppHost in Rider first: `aspire exec` starts its own AppHost rather than attaching
to the instance already running in Rider. From the repository root, enable the preview
command once:

```powershell
aspire config set features.execCommandEnabled true
```

Then use the repository wrapper to run Admin commands in the `api` resource environment
so they receive Aspire's PostgreSQL and Redis connection strings:

```powershell
.\scripts\admin.ps1 health
.\scripts\admin.ps1 sync-bank-holidays
```

Each command starts the AppHost, waits until `api` is running, executes the Admin command,
and shuts the AppHost down when it finishes. Aspire 13.3 may log a non-fatal
`ASPNETCORE_URLS` substitution warning when it copies the web resource environment to the
Admin process. Use the final `Aspire exec exit code` and Admin output to determine success.

To run services without the AppHost:

```powershell
docker compose up postgres redis
dotnet run --project src/backend/ExpensePlanner.Api
pnpm --dir src/frontend dev
```

Copy `.env.example` to `.env` for Compose values. Never commit `.env`, signing keys,
database dumps, setup codes or recovery codes.

For a complete from-zero container setup, including local HTTPS certificate trust,
first-owner registration, production DNS, backups and Admin CLI commands, follow the
[Docker Compose setup and operations guide](docs/docker-compose.md).

## First user and account recovery

On an empty database, open `http://localhost:3000`. The application redirects to
`/register`, where you enter the first owner's email. Registration creates a one-hour
setup session and then asks for a password and whether to enable an authenticator. Ten
single-use recovery codes are displayed when authenticator MFA is enabled. MFA is
selected by default, can be skipped during setup, and can later be enabled or disabled
per account from Settings.

First-owner registration is available only while no users exist. It closes immediately
after the first pending owner is created; every later user requires an authenticated
invitation.

To recover an existing user:

```powershell
.\scripts\admin.ps1 reset-user -Email you@example.com
```

This revokes active refresh-token families and issues a fresh one-hour setup code.

Other operations:

```powershell
.\scripts\admin.ps1 sync-bank-holidays
.\scripts\admin.ps1 health
```

## Migrations

The API applies pending EF Core migrations before opening its HTTP listener in development
and production. Startup fails if PostgreSQL is unavailable or a migration fails. The
Admin `migrate` command remains available as an operational fallback, but it is not part
of normal first-run setup.

```powershell
dotnet tool restore
dotnet tool run dotnet-ef migrations add MeaningfulName `
  --project src/backend/ExpensePlanner.Infrastructure `
  --startup-project src/backend/ExpensePlanner.Api `
  --output-dir Persistence/Migrations
```

Review generated SQL and model changes. Never edit an applied migration; add a new one.

## Docker Compose

The production-shaped stack runs PostgreSQL, Redis, API, Node SSR frontend and Caddy.
The API applies pending migrations before becoming healthy. PostgreSQL and Redis are not
published to the host.

See the [Docker Compose setup and operations guide](docs/docker-compose.md) for the full
local and production procedure. The short form, after preparing `.env` and the signing
key, is:

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

## Tests and checks

```powershell
dotnet format ExpensePlanner.slnx --verify-no-changes --no-restore
dotnet build ExpensePlanner.slnx --no-restore
dotnet test ExpensePlanner.slnx --no-build

pnpm --dir src/frontend format
pnpm --dir src/frontend lint
pnpm --dir src/frontend typecheck
pnpm --dir src/frontend test
pnpm --dir src/frontend build
```

Set `RUN_INTEGRATION_TESTS=true` to enable Docker-backed PostgreSQL integration tests.
CI also verifies the generated TypeScript OpenAPI declarations, Playwright flows,
Compose configuration, source dependencies and filesystem vulnerability gates. CI does
not build Compose images; image builds are performed during deployment.

## Backup and restore

Only PostgreSQL needs durable backup. Redis can be discarded.

```powershell
docker compose exec -T postgres pg_dump -U expense_planner `
  --format=custom expense_planner > expense-planner.dump

docker compose exec -T postgres pg_restore -U expense_planner `
  --clean --if-exists --dbname=expense_planner < expense-planner.dump
```

Encrypt backups at rest, retain multiple generations and routinely test restores in a
separate environment. Stop application writes or take a transactionally consistent dump
before disaster-recovery work. After restoring, restart API/frontend containers; cached
data will repopulate.

## Branches and releases

`main` is production-ready and `staging` is the integration branch. `feature/*`,
`bug/*`, `chore/*` and `docs/*` branch from and merge into `staging` with squash merges
and Conventional Commit-style PR titles. Promote with a merge-commit PR from `staging`
to `main`. Emergency `bug/hotfix-*` branches may target `main`, then `main` is merged
forward to `staging`.

See [AGENTS.md](AGENTS.md) for engineering rules and
[docs/roadmap.md](docs/roadmap.md) for the delivery slices. Container deployment and
operations are documented in [docs/docker-compose.md](docs/docker-compose.md).
