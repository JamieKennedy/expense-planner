# Delivery roadmap

Each phase is a GitHub milestone. Issues below are intentionally vertical, independently
mergeable slices.

## 1 — Foundation and operations

- Repository policy, templates and protected-branch checks
- .NET/React solution skeleton with central dependency locks
- Aspire PostgreSQL/Redis/API/frontend orchestration
- Production Compose, migration ordering, Caddy and health checks
- OpenTelemetry defaults, operational README and backup/restore runbook

## 2 — Identity and planner isolation

- Bootstrap/setup-code flow and default “Me” contributor
- Password plus mandatory TOTP enrollment and recovery codes
- Access-cookie JWT and rotating opaque refresh-token families
- Logout, reset revocation, CSRF and login throttling
- Invite creation/redemption into an isolated planner
- Protected SSR loaders and cross-planner integration tests

## 3 — Planner reference data

- Account CRUD and archive behavior
- Contributor CRUD and archive behavior
- Coloured tag CRUD and archive behavior
- Responsive settings experience and uniqueness failures

## 4 — Monthly commitments

- Expense CRUD with tags, accounts and deterministic shares
- Income CRUD and destination accounts
- GOV.UK holiday synchronization and calendar-unavailable behavior
- Short-month and next-working-day projection
- Server pagination, sorting and OR-within/AND-between filters

## 5 — Budget and reporting

- One recurring tag-linked budget template
- Allowance and custom contributor splits
- Monthly income/out/net overview
- Contributor and intentionally non-additive tag reports
- Budget projection, remaining/over-budget and contributor totals

## 6 — Production hardening

- Full bootstrap/invite Playwright journeys
- Compose startup, refresh and graceful-restart smoke tests
- Accessibility and responsive audits
- Dependency, CodeQL and high/critical container vulnerability gates
- Restore drill and release promotion checklist

## Explicitly later

Transactions, paid/reconciled state, bank feeds, imports, balances, one-off commitments,
variable recurrence, currencies beyond GBP, shared authenticated planners and immutable
historical snapshots are not V1 work.
