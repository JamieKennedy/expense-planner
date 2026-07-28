# Expense Planner

A private, invite-only planner for recurring monthly income, expenses and budgets.
Expense Planner projects today’s definitions onto any month; it is deliberately not a
transaction ledger and does not track whether a payment cleared.

## What it does

- Keeps accounts, contributors and coloured tags isolated in each user’s planner.
- Splits each GBP expense by exact integer basis points and allocates penny remainders
  deterministically.
- Clamps days 29–31 in short months and can advance dates over weekends and official
  England/Wales bank holidays.
- Provides monthly income/out/net, contributor, tag and tag-linked budget reports.
- Supports server-paginated expense filtering by account, contributor and tag.
- Requires invite/bootstrap setup, password, TOTP MFA and rotating refresh sessions.

An expense with several tags appears once in filtered lists, but its full value belongs to
each individual tag report. Tag totals are therefore intentionally non-additive.

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

```powershell
dotnet restore ExpensePlanner.slnx --locked-mode
pnpm --dir src/frontend install --frozen-lockfile
dotnet run --project src/orchestration/ExpensePlanner.AppHost
```

Aspire starts PostgreSQL 18, Redis 8.2, the API and the frontend. It injects service
discovery connection details. The first run may pull container images.

To run services without the AppHost:

```powershell
docker compose up postgres redis
dotnet run --project src/backend/ExpensePlanner.Admin -- migrate
dotnet run --project src/backend/ExpensePlanner.Api
pnpm --dir src/frontend dev
```

Copy `.env.example` to `.env` for Compose values. Never commit `.env`, signing keys,
database dumps, setup codes or recovery codes.

## First user and account recovery

The application has no public registration. Apply migrations, then create the first user:

```powershell
dotnet run --project src/backend/ExpensePlanner.Admin -- bootstrap-user --email you@example.com
```

The command is allowed only while no user exists. It prints a one-time `/setup?code=…`
path valid for one hour. The setup page sets the password, requires a valid authenticator
code and displays ten single-use recovery codes. Passwords never appear on the command
line.

To recover an existing user:

```powershell
dotnet run --project src/backend/ExpensePlanner.Admin -- reset-user --email you@example.com
```

This revokes active refresh-token families and issues a fresh one-hour setup code.

Other operations:

```powershell
dotnet run --project src/backend/ExpensePlanner.Admin -- sync-bank-holidays
dotnet run --project src/backend/ExpensePlanner.Admin -- health
```

## Migrations

The API never migrates itself in production. Aspire and Compose run the Admin `migrate`
command as a one-shot dependency before the API starts.

```powershell
dotnet tool restore
dotnet tool run dotnet-ef migrations add MeaningfulName `
  --project src/backend/ExpensePlanner.Infrastructure `
  --startup-project src/backend/ExpensePlanner.Api `
  --output-dir Persistence/Migrations
```

Review generated SQL and model changes. Never edit an applied migration; add a new one.

## Production with Compose

Generate a PKCS#8 RSA private key and set the values described in `.env.example`:

```powershell
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out jwt-private.pem
docker compose config
docker compose up --build -d
```

Caddy terminates HTTPS and exposes the Node SSR frontend and API on one origin. PostgreSQL
and Redis are not published to the host. `migrate` must complete successfully before API
startup. Use a real DNS name in `APP_HOST`; Caddy obtains and renews its certificate.

Create the production bootstrap user through the one-shot Admin image:

```powershell
docker compose run --rm migrate bootstrap-user --email you@example.com
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
container builds and vulnerability gates.

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
[docs/roadmap.md](docs/roadmap.md) for the delivery slices.
