# Docker Compose setup and operations

This guide starts a complete Expense Planner instance with PostgreSQL, Redis, the .NET
API, the Node SSR frontend and Caddy. PostgreSQL and Redis stay on the private Compose
network; Caddy is the only service that publishes host ports.

## 1. Prerequisites

Install:

- Git
- Docker Desktop, or Docker Engine with Docker Compose v2
- OpenSSL 3

Confirm the tools are available:

```text
git --version
docker version
docker compose version
openssl version
```

For a remote production host, also arrange a DNS name and allow inbound TCP ports 80
and 443. You do not need .NET, Node.js or pnpm on a Compose-only host.

## 2. Clone and create the environment

```text
git clone https://github.com/JamieKennedy/expense-planner.git
cd expense-planner
```

Create the untracked `.env` file:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force secrets
```

```bash
# macOS or Linux
cp .env.example .env
mkdir -p secrets
```

Edit `.env` before starting anything:

```dotenv
APP_HOST=localhost
POSTGRES_PASSWORD=replace-with-a-long-random-password
JWT_PRIVATE_KEY_FILE=./secrets/jwt-private.pem
API_INTERNAL_URL=http://api:8080
```

Use a password-manager-generated PostgreSQL password. Keep this password stable while
the `postgres-data` volume exists. PostgreSQL reads it only when it creates the database;
changing the value later does not update the existing database user's password.

Generate the asymmetric JWT signing key:

```text
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out secrets/jwt-private.pem
```

Keep the key stable and private. Replacing it invalidates access JWTs and signs users
out. Do not commit `.env`, `secrets/`, database dumps, setup codes or recovery codes.
On a production Linux host, restrict key permissions:

```bash
chmod 600 secrets/jwt-private.pem
```

Validate interpolation, mounts and service dependencies without starting containers:

```text
docker compose config --quiet
```

If this reports a missing variable or signing-key file, fix `.env` or the path before
continuing.

## 3. Start the local HTTPS stack

Build and start all long-running services:

```text
docker compose up --build -d
docker compose ps
```

The first build downloads base images and dependencies. The API waits for PostgreSQL and
Redis health checks, applies all pending EF Core migrations, and only then becomes
healthy. Inspect startup if a service is not healthy:

```text
docker compose logs --tail 200 postgres redis api frontend caddy
docker compose logs --follow api
```

Open [https://localhost](https://localhost). In Docker Desktop, expand the
`expense-planner` application and click the published `443` link on the `caddy`
container. Caddy is the public HTTPS entry point for both the frontend and `/api`; the
Node `frontend` container intentionally has no directly published port.

On an empty database the application opens first-owner registration. Enter the owner's
email, choose a strong password, and decide whether to use authenticator MFA. MFA is
enabled by default and recommended, but it can be skipped and enabled later from
Settings.

## 4. Trust Caddy's local certificate

For `APP_HOST=localhost`, Caddy creates its own local certificate authority in the
persistent `caddy-data` volume. Copy its root certificate to the repository directory:

```text
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./expense-planner-local-root.crt
```

Trust only the certificate copied from your own Caddy container.

### Windows

Open PowerShell as Administrator in the repository and run:

```powershell
certutil -addstore -f ROOT .\expense-planner-local-root.crt
```

Close and reopen the browser. To remove it later, open `certmgr.msc`, find the Caddy
Local Authority under Trusted Root Certification Authorities, and delete that entry.

### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain expense-planner-local-root.crt
```

Restart the browser after adding the certificate.

### Linux

For Debian and Ubuntu:

```bash
sudo cp expense-planner-local-root.crt \
  /usr/local/share/ca-certificates/expense-planner-local-root.crt
sudo update-ca-certificates
```

Other distributions use their normal system CA trust command. Firefox may use its own
certificate store depending on distribution and browser settings.

For a quick local-only fallback, use the browser's advanced option to continue past the
certificate warning. Do not use that fallback for a real production domain.

## 5. Production deployment

Before the first production start:

1. Point an `A` and/or `AAAA` record for the chosen hostname at the server.
2. Set `APP_HOST` in `.env` to that hostname, without `https://` or a path.
3. Allow inbound TCP 80 and 443 through the host and provider firewalls.
4. Store `.env` and the signing key outside version control, readable only by the
   deployment account.
5. Use a unique, strong PostgreSQL password and retain a secure copy of both stable
   secrets.

Example:

```dotenv
APP_HOST=planner.example.com
POSTGRES_PASSWORD=a-password-manager-generated-value
JWT_PRIVATE_KEY_FILE=/opt/expense-planner/secrets/jwt-private.pem
API_INTERNAL_URL=http://api:8080
```

Then validate and start:

```text
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Caddy obtains and renews a public certificate automatically after DNS and ports are
correct. Open `https://planner.example.com` to register the first owner. Keep PostgreSQL
and Redis unpublished; they require no public firewall rules.

## 6. Routine operations

### Status, health and logs

```text
docker compose ps
docker compose run --rm admin health
docker compose logs --tail 200
docker compose logs --follow api frontend caddy
```

The public health endpoint is:

```text
https://your-app-host/health
```

For local certificate troubleshooting before trusting the root, `curl -k
https://localhost/health` bypasses certificate validation for that single check.

### Admin CLI

The Admin image uses the same PostgreSQL, Redis and signing-key configuration:

```text
docker compose run --rm admin health
docker compose run --rm admin sync-bank-holidays
docker compose run --rm admin reset-user --email you@example.com
docker compose run --rm admin migrate
```

`reset-user` revokes refresh sessions and prints a one-hour setup code. Open
`https://your-app-host/setup?code=...`; the recovered user may enable or leave MFA
disabled. The API normally runs migrations automatically, so `migrate` is only an
operational fallback.

### Update and restart

Pull repository changes, refresh base images, rebuild application images, and recreate
changed services:

```text
git pull --ff-only
docker compose pull postgres redis caddy
docker compose build --pull api frontend admin
docker compose up -d
docker compose ps
```

Restart without rebuilding:

```text
docker compose restart
```

Stop and remove containers and their private network while preserving PostgreSQL and
Caddy volumes:

```text
docker compose down
```

> **Destructive:** `docker compose down -v` deletes the PostgreSQL and Caddy volumes.
> Expense data cannot be recovered unless you have a separate database backup.

## 7. Backup and restore

PostgreSQL is authoritative; Redis is disposable and does not need a backup. Create a
plain SQL backup:

```text
docker compose exec -T postgres pg_dump \
  --username=expense_planner \
  --clean --if-exists \
  expense_planner > expense-planner.sql
```

PowerShell accepts the same command on one line:

```powershell
docker compose exec -T postgres pg_dump --username=expense_planner --clean --if-exists expense_planner > expense-planner.sql
```

Encrypt backups at rest and copy them away from the Docker host. Keep multiple
generations and test restoration regularly.

To replace the current database from a reviewed backup, first stop application writes:

```text
docker compose stop caddy frontend api
docker compose exec -T postgres psql --username=expense_planner --dbname=expense_planner < expense-planner.sql
docker compose up -d
docker compose ps
```

Restore is intentionally operational and potentially destructive: test it against a
separate instance first. Redis caches repopulate after startup.

## 8. Troubleshooting

- `postgres` is unhealthy: check `docker compose logs postgres`; a changed `.env`
  password does not alter credentials in an existing volume.
- `api` exits: check its logs for a database migration or signing-key error.
- `frontend` is healthy but the page fails: check both `frontend` and `caddy` logs.
- Caddy cannot get a public certificate: verify `APP_HOST`, DNS resolution, and inbound
  ports 80/443.
- The local browser warns after trust: restart the browser and confirm the trusted root
  came from the current `caddy-data` volume.
- Port 80 or 443 is already in use: stop the conflicting web server or change the host
  deployment; Caddy needs both ports for normal public certificate automation.
