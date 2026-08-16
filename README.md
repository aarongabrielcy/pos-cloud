# pos-cloud

Cloud backend for **POSPlatform Premium**. Not a Mercado Pago backend - this repository grows,
task by task, into three things on top of a single modular monolith:

1. **Vendor / Admin Control Plane**
2. **Payment Orchestrator**
3. **Premium Commerce Data Plane**

POSPlatform **Basic** is fully local-first (SQLite, manual payments, no cloud dependency) and never
talks to this service. pos-cloud only matters once an installation upgrades to **Premium**
(integrated payment terminals, Payment Orchestrator, cloud backups, sync, consolidation,
multi-device operation, and a future - currently frozen - POS Web).

## Status: CLOUD-01C-D - Installation Heartbeat / Operational Health / Audit Base

CLOUD-01A built the Foundation (monorepo, processes, database/cache wiring, configuration,
observability, health checks, architecture enforcement, Docker). CLOUD-01B added the first three
real bounded contexts on top of it: **Customer Management**, **Licensing**, and **Installations** -
see [docs/architecture/control-plane-core.md](docs/architecture/control-plane-core.md) for the full
design and [docs/architecture/control-plane-data-model.md](docs/architecture/control-plane-data-model.md)
for the schema/ER diagram. CLOUD-01C-A added a fourth bounded context, **Access Management**: admin
identity, Argon2id password hashing, JWT access tokens, rotating opaque refresh sessions with
replay detection, and a `GET /auth/me` route - see
[docs/architecture/admin-authentication.md](docs/architecture/admin-authentication.md) and
[ADR-012](docs/adr/ADR-012-admin-authentication-strategy.md). CLOUD-01C-B extended that same package
with RBAC and made every administrative route deny by default - see
[docs/architecture/admin-rbac.md](docs/architecture/admin-rbac.md) and
[ADR-013](docs/adr/ADR-013-admin-rbac-strategy.md). CLOUD-01C-C added a second, completely independent
identity plane for POS machines - one-time enrollment codes, an opaque permanent credential, and real
activation (`PENDING -> ACTIVE`) - see
[docs/architecture/installation-enrollment.md](docs/architecture/installation-enrollment.md) and
[ADR-014](docs/adr/ADR-014-installation-enrollment-strategy.md). CLOUD-01C-D adds installation
heartbeat/operational health (computed, never persisted, always separate from lifecycle status) and a
fifth bounded context, **Audit** - an append-only record of every real administrative/machine action
across the Control Plane - see
[docs/architecture/installation-health.md](docs/architecture/installation-health.md),
[docs/architecture/audit.md](docs/architecture/audit.md), and
[ADR-015](docs/adr/ADR-015-installation-health-and-audit-strategy.md). All CLOUD-01C-A/B/C migrations
are applied; the three CLOUD-01C-D migrations are **not yet applied** - see
"Database / migrations" below.

**Every Customers/Licenses/Installations route requires a Bearer admin access token and the
specific RBAC permission it needs.** `POST /api/v1/auth/{login,refresh,logout}` and `/health*`
remain reachable without one; `GET /api/v1/auth/me` requires a valid token but no specific
permission. A handler with no explicit `@Public()`/`@AuthenticatedOnly()`/`@RequirePermissions()`
classification is denied by default, even if authenticated - see
[admin-rbac.md#default-deny](docs/architecture/admin-rbac.md#default-deny). `/docs` and
`/openapi.json` themselves are unauthenticated (dev-only, `NODE_ENV !== "production"`), same as
before - only the _business operations_ they describe now require credentials. `/api/v1/installation-auth/*`
is a **separate machine identity plane** (an admin access JWT is never accepted there, and an
installation credential is never accepted on an admin route) - see
[installation-enrollment.md#identity-separation](docs/architecture/installation-enrollment.md#identity-separation).

Mercado Pago and the Point A910 terminal are **not implemented here** - they arrive later as a
Payment Orchestrator adapter (CLOUD-03), behind a Ports/Adapters boundary
([ADR-008](docs/adr/ADR-008-provider-integrations-behind-ports-and-adapters.md)). Payment
Orchestrator itself is **planned**, not implemented, in this repository state. Installation
enrollment/credentials/activation (CLOUD-01C-C) and heartbeat/operational health/audit (CLOUD-01C-D)
are implemented (pending the three CLOUD-01C-D migrations above); periodic credential rotation, an
Outbox-backed audit delivery guarantee, admin login/security-event auditing, and everything else
listed in the "Not implemented"/"Non-goals" sections of
[control-plane-core.md](docs/architecture/control-plane-core.md#not-implemented-in-cloud-01b),
[admin-authentication.md](docs/architecture/admin-authentication.md#not-implemented-in-cloud-01c-a),
[admin-rbac.md](docs/architecture/admin-rbac.md#non-goals),
[installation-enrollment.md](docs/architecture/installation-enrollment.md#non-goals-cloud-01c-c),
[installation-health.md](docs/architecture/installation-health.md#non-goals), and
[audit.md](docs/architecture/audit.md#non-goals)
remain planned (role/permission administration endpoints, MFA, rate limiting, password recovery, and
more).

## Architecture

See [docs/architecture/overview.md](docs/architecture/overview.md) for diagrams and full detail.
Summary:

- **Style**: Modular Monolith, DDD by bounded context, microservice-ready boundaries -
  no microservices yet ([ADR-001](docs/adr/ADR-001-modular-monolith-before-microservices.md)).
- **Internal layering**: Hexagonal + Clean Architecture - Domain has zero framework dependencies;
  Application depends only on Domain and ports; Infrastructure implements those ports; Presentation
  (NestJS HTTP) depends on Application
  ([ADR-002](docs/adr/ADR-002-hexagonal-clean-architecture.md)).
- **CQRS**: selective, not ceremonial
  ([ADR-003](docs/adr/ADR-003-selective-cqrs.md)).
- **Data ownership**: one PostgreSQL schema per bounded context, no cross-schema foreign keys, no
  cross-context joins ([ADR-007](docs/adr/ADR-007-bounded-context-data-ownership.md),
  [ADR-010](docs/adr/ADR-010-no-cross-bounded-context-database-foreign-keys.md)).
- **Cross-context communication**: application-layer ports owned by the consumer, bound to an
  in-process adapter only in `apps/api`'s composition root - never a direct import between
  bounded contexts ([ADR-009](docs/adr/ADR-009-control-plane-core-bounded-contexts.md)).
- **API contract**: OpenAPI, generated at runtime from live decorators
  ([ADR-011](docs/adr/ADR-011-openapi-as-contract-with-pos-admin-web.md)).
- Enforced by code, not just documentation: `pnpm test:architecture` runs dependency-cruiser
  against the real import graph and fails the build on a real violation - see
  [tests/architecture/README.md](tests/architecture/README.md).

All ADRs: [docs/adr/](docs/adr/). Control Plane design in full:
[docs/architecture/control-plane-core.md](docs/architecture/control-plane-core.md) and
[docs/architecture/control-plane-data-model.md](docs/architecture/control-plane-data-model.md).

## Processes

Two deployable processes of the same modular monolith
([ADR-004](docs/adr/ADR-004-separate-api-and-worker-deployables.md)):

| Process       | What it is                                        | What it does as of this state                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`    | NestJS HTTP process                               | `/health`, `/health/live`, `/health/ready` (`@Public()`); helmet; global `ValidationPipe`; structured logging with correlation IDs; graceful shutdown. Admin login/RBAC on business routes, plus a separate installation identity plane under `/installation-auth/*` and `/installation-health/*` (see "Control Plane API" below). |
| `apps/worker` | NestJS application-context process (no HTTP port) | Loads config, connects PostgreSQL + Redis, stays alive on those connections, shuts down cleanly on SIGTERM/SIGINT. No business jobs yet - ships a standalone `dist/healthcheck.js` for Docker instead of an HTTP port.                                                                                                             |

## Requirements

- Node.js 24.x LTS
- pnpm 11.4.0 (pinned via `packageManager` in `package.json` - use Corepack or an equivalent
  matching install)
- Docker + Docker Compose v2, for the containerized development environment

## Installation

```sh
pnpm install
```

## External configuration

Real configuration for local development is **outside this repository**, at:

```
../config/pos-cloud/infrastructure.env
../config/pos-cloud/api.env
../config/pos-cloud/worker.env
```

(relative to this repo's parent directory - i.e. `pos-system/config/pos-cloud/` alongside
`pos-system/pos-cloud/`). They are never copied into the repo, never logged, never committed
([ADR-006](docs/adr/ADR-006-external-configuration-and-secrets.md)).

Docker Compose itself lives **outside this repository too**, at
[`pos-system/infra/docker-compose.yml`](../infra/docker-compose.yml) - see
[`pos-system/infra/README.md`](../infra/README.md) for the full operational guide. It consumes
these env files directly via `env_file`, one file per concern: `infrastructure.env` bootstraps the
`postgres` container itself (only on first init of an empty volume); `api.env`/`worker.env` carry
each process's full runtime configuration.

`api.env` also carries `AUTH_*` variables (`AUTH_JWT_SECRET`/`AUTH_JWT_ISSUER`/
`AUTH_JWT_AUDIENCE`/`AUTH_ACCESS_TOKEN_TTL_SECONDS`/`AUTH_REFRESH_TOKEN_TTL_SECONDS`/
`AUTH_REFRESH_COOKIE_NAME`, CLOUD-01C-A) - **deliberately absent from `infrastructure.env` and
`worker.env`**: only `apps/api` has an authentication surface, so only it needs `AUTH_JWT_SECRET`.
See [docs/architecture/admin-authentication.md](docs/architecture/admin-authentication.md#config-auth_).
`api.env` also carries `INSTALLATION_ENROLLMENT_TTL_SECONDS` (default 900, CLOUD-01C-C) - loaded
independently of the `AUTH_*` group, since installation identity's configuration must never be
coupled to AdminUser identity's - see
[installation-enrollment.md](docs/architecture/installation-enrollment.md#config). `api.env` also
carries `INSTALLATION_HEARTBEAT_INTERVAL_SECONDS`/`_STALE_AFTER_SECONDS`/`_OFFLINE_AFTER_SECONDS`
(defaults 60/120/300, CLOUD-01C-D, sufficient for development with no edit required) - see
[installation-health.md](docs/architecture/installation-health.md#config).

This repo only ships [.env.example](.env.example) - variable **names** with non-sensitive
placeholders, for reference and for running a process directly on the host (outside Docker).

**Container networking note**: inside `docker-compose.yml`, `DATABASE_HOST`/`DATABASE_PORT` and
`REDIS_HOST`/`REDIS_PORT` are pinned explicitly to the compose service names and internal ports
(`postgres:5432`, `redis:6379`) via each service's `environment:` block, overriding whatever the
env files set for other run modes. Credentials (`DATABASE_USER`, `DATABASE_PASSWORD`,
`DATABASE_NAME`) still come from the external env files.

Config is centralized, typed, and validated at process startup (`libs/config`, zod). An invalid or
incomplete environment fails the process immediately with a clear, value-free error - see
`libs/config/src/load-config.ts`.

## Commands

```sh
pnpm build             # turbo run build (libs first, then apps)
pnpm lint              # eslint across all packages
pnpm typecheck         # tsc --noEmit across all packages
pnpm test              # jest unit tests, per package
pnpm test:architecture # dependency-cruiser rules (see tests/architecture/README.md)
pnpm format / format:check
pnpm validate           # format:check && lint && typecheck && test && test:architecture && build
```

Per-app dev/run (after `pnpm build`, or via `start:dev` with `ts-node`):

```sh
pnpm --filter @pos-cloud/api start:dev
pnpm --filter @pos-cloud/worker start:dev
```

## Docker

CLI only - no Docker Desktop UI, no Kubernetes, no Swarm, no registry push. The Compose file lives
**outside this repository**, at [`pos-system/infra/docker-compose.yml`](../infra/docker-compose.yml)
(same `root/{proyectos, config, infra}` layout as the user's other projects), but every command
below works from **this** directory - no `cd ../infra` needed for day-to-day work:

```sh
pnpm infra:build         # docker compose -f ../infra/docker-compose.yml build
pnpm infra:up            # docker compose -f ../infra/docker-compose.yml up -d
pnpm infra:ps            # docker compose -f ../infra/docker-compose.yml ps
pnpm infra:logs:api      # docker compose -f ../infra/docker-compose.yml logs -f pos-cloud-api
pnpm infra:logs:worker   # docker compose -f ../infra/docker-compose.yml logs -f pos-cloud-worker
pnpm infra:down          # docker compose -f ../infra/docker-compose.yml down - never `-v`, that
                          # would drop the named volumes
```

These are thin `docker compose -f ../infra/docker-compose.yml ...` wrappers - `infra/` remains the
one source of truth for how the stack is orchestrated (see
[`pos-system/infra/README.md`](../infra/README.md) for the full guide and for any command not
listed here, e.g. `docker compose logs -f postgres`).

Services: `postgres` (`postgres:16-alpine`), `redis` (`redis:7-alpine`), `pos-cloud-api`,
`pos-cloud-worker`, all on the `pos-cloud-network` network. Named volumes
`pos-cloud-postgres-data` and `pos-cloud-redis-data` persist data across restarts.

Host ports (chosen to avoid clashing with a local PostgreSQL/Redis install):

- API: `5100:5100`
- PostgreSQL: `5433:5432` (debug access only; the API/worker containers talk to `postgres:5432`
  over the compose network)
- Redis: `6380:6379` (debug access only; containers talk to `redis:6379`)

Both `pos-cloud-api` and `pos-cloud-worker` images are built from the single parameterized
[Dockerfile](Dockerfile) at this repo's root (`--build-arg APP_NAME=api` or `worker`), run as the
non-root `node` user, and are multi-stage so the runtime image ships compiled `dist/` output and
production dependencies only. A fourth stage, `tooling`, keeps the full source tree and
devDependencies (ts-node, the TypeORM CLI) - never deployed as a runtime image, used only by the
migration tooling services below.

### Migration tooling services

`pnpm migration:show` / `migration:run` / `migration:revert` (see "Database / migrations" below)
delegate to three Compose services that run one-off migration commands via `docker compose run`,
kept out of `up -d` with `profiles: ["tools"]`. Calling them directly from `../infra/` also works:

```sh
docker compose run --rm --build pos-cloud-migration-show      # safe - lists migration state
docker compose run --rm --build pos-cloud-migrations           # applies migrations - user only
docker compose run --rm --build pos-cloud-migration-revert      # reverts last migration - user only
docker compose run --rm --build \
  -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_PASSWORD -e BOOTSTRAP_ADMIN_DISPLAY_NAME \
  pos-cloud-admin-bootstrap                                     # creates the first admin - user only
```

## Health endpoints

| Endpoint            | Meaning                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health/live`  | Process is alive. No dependency is checked.                                                                                                         |
| `GET /health/ready` | Real readiness: PostgreSQL (`SELECT 1` via the TypeORM DataSource) and Redis (`PING`) are both checked. Returns a non-2xx status if either is down. |
| `GET /health`       | Aggregate health, equivalent to `/health/ready`, kept for operator convenience.                                                                     |

The worker has no HTTP port; its Docker healthcheck runs `apps/worker/dist/healthcheck.js`, a
standalone script (no Nest bootstrap) that checks PostgreSQL and Redis the same way and exits 0/1.

## Control Plane API

Business routes live under `/api/v1/control-plane/...` (health endpoints above are unaffected):

| Resource      | Routes                                                                                                                                                      | Required permission (see [admin-rbac.md](docs/architecture/admin-rbac.md))                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers     | `POST /customers`, `GET /customers/:id`, `GET /customers` (paginated), `PATCH /customers/:id/status`                                                        | `customers.create`, `customers.read` (x2), `customers.status.change`                                                                                                                            |
| Licenses      | `POST /licenses`, `GET /licenses/:id` (incl. entitlements), `GET /licenses` (paginated), `PATCH /licenses/:id/status`, `PUT /licenses/:id/entitlements`     | `licenses.create`, `licenses.read` (x2), `licenses.status.change`, `licenses.entitlements.manage`                                                                                               |
| Installations | `POST /installations`, `GET /installations/:id`, `GET /installations` (paginated), `PATCH /installations/:id/status`                                        | `installations.create`, `installations.read` (x2), `installations.status.change`                                                                                                                |
| Installations | `POST /installations/:id/enrollment`, `POST /installations/:id/credentials/recovery-enrollment`, `POST /installations/:id/credentials/revoke` (CLOUD-01C-C) | `installations.enrollment.manage`, `installations.credentials.manage` (x2) - see [installation-enrollment.md#admin-permissions](docs/architecture/installation-enrollment.md#admin-permissions) |
| Installations | `GET /installations/:id/health` (CLOUD-01C-D)                                                                                                               | `installations.read` (reused, no new permission)                                                                                                                                                |
| Audit         | `GET /audit-events` (paginated, filterable, CLOUD-01C-D)                                                                                                    | `audit.read` - see [audit.md#rbac](docs/architecture/audit.md#rbac)                                                                                                                             |

(all under `/api/v1/control-plane/`, all requiring a Bearer admin access token as of CLOUD-01C-B).
List endpoints share one pagination contract: `page` (default
1), `pageSize` (default 25, max 100), `items`, `total`, `totalPages`. Errors share one contract:
`{ statusCode, code, message, correlationId, details? }` (see
[docs/architecture/control-plane-core.md](docs/architecture/control-plane-core.md#http-api)).

**Auth** (under `/api/v1/auth`, not `/api/v1/control-plane/`):
`POST /login`, `POST /refresh`, `POST /logout` (all `@Public()`), `GET /me` (Bearer-protected, no
specific permission - `@AuthenticatedOnly()`) - see
[docs/architecture/admin-authentication.md](docs/architecture/admin-authentication.md). No
`register`/`signup` endpoint exists; admins are created only via `pnpm admin:bootstrap`.

**Installation Auth** (under `/api/v1/installation-auth`, CLOUD-01C-C - a machine identity plane,
completely separate from the admin `Auth`/RBAC above): `POST /enroll` (no Bearer token of any kind -
the one-time enrollment code in the request body is this endpoint's own authentication mechanism),
`GET /session` (installation-Bearer-protected, minimal identity check) - see
[docs/architecture/installation-enrollment.md](docs/architecture/installation-enrollment.md).

**Installation Health** (under `/api/v1/installation-health`, CLOUD-01C-D - same machine identity
plane as above): `POST /heartbeat` (installation-Bearer-protected, 204 No Content) - see
[docs/architecture/installation-health.md](docs/architecture/installation-health.md).

**OpenAPI** is generated at runtime from live decorators (never a static file) - in any
non-production environment: Swagger UI at `GET /docs`, raw document at `GET /openapi.json`. See
[ADR-011](docs/adr/ADR-011-openapi-as-contract-with-pos-admin-web.md). The document declares an
`admin-bearer` HTTP Bearer security scheme on `GET /auth/me` and every business/audit operation
above, and a separate `installation-bearer` scheme on `GET /installation-auth/session` and
`POST /installation-health/heartbeat` only. The future admin frontend (`pos-admin-web`, a separate
repository - not created here) will generate its API client from `/openapi.json`; this repository
never shares TypeScript source with it.

Installation activation (`PENDING -> ACTIVE`) is intentionally **not** exposed through the admin
status-change endpoint - as of CLOUD-01C-C it only ever happens through a successful machine
enrollment (`POST /installation-auth/enroll`), never an admin action - see
[installation-enrollment.md](docs/architecture/installation-enrollment.md#initial-vs-recovery-enrollment).

## Database / migrations

- TypeORM, PostgreSQL 16.
- **`synchronize: false` and `migrationsRun: false` always** - in every environment, with no
  override. Schema changes only happen through a migration the user runs explicitly
  ([ADR-005](docs/adr/ADR-005-postgresql-and-redis.md)).
- A single reusable `DataSource` configuration (`libs/database`) is shared by `apps/api`,
  `apps/worker`, and `migration:create`/`show`/`run`/`revert`.
- Eight migrations exist:
  1. [`1786312046358-CreateControlPlaneCore.ts`](libs/database/src/migrations/1786312046358-CreateControlPlaneCore.ts) -
     creates the `control_plane`, `licensing`, and `installations` schemas and their four tables (see
     [docs/architecture/control-plane-data-model.md](docs/architecture/control-plane-data-model.md)).
     **Applied** - `pnpm migration:show` confirms `[X] CreateControlPlaneCore1786312046358`.
  2. [`1786391749789-CreateAccessManagementAuth.ts`](libs/database/src/migrations/1786391749789-CreateAccessManagementAuth.ts) -
     creates the `access_management` schema and its `admin_users`/`admin_sessions` tables (CLOUD-01C-A,
     see [docs/architecture/admin-authentication.md](docs/architecture/admin-authentication.md)).
     **Applied**.
  3. [`1786551814732-CreateAccessManagementRbac.ts`](libs/database/src/migrations/1786551814732-CreateAccessManagementRbac.ts) -
     adds `permissions`/`admin_roles`/`role_permissions`/`admin_user_roles` to the `access_management`
     schema, seeds the V1 catalog (10 permissions, 3 roles, 22 mappings), and backfills `PLATFORM_ADMIN`
     onto any pre-existing `admin_users` row (CLOUD-01C-B, see
     [docs/architecture/admin-rbac.md](docs/architecture/admin-rbac.md)). **Applied** - immutable from
     this point on, never edited again.
  4. [`1786568237542-CreateInstallationEnrollmentCredentials.ts`](libs/database/src/migrations/1786568237542-CreateInstallationEnrollmentCredentials.ts) -
     adds `installation_enrollments`/`installation_credentials` to the `installations` schema
     (CLOUD-01C-C, see
     [docs/architecture/installation-enrollment.md](docs/architecture/installation-enrollment.md#data-model)).
     **Applied**.
  5. [`1786568239053-ExtendAccessManagementRbacForInstallationEnrollment.ts`](libs/database/src/migrations/1786568239053-ExtendAccessManagementRbacForInstallationEnrollment.ts) -
     adds `installations.enrollment.manage`/`installations.credentials.manage` and their role mappings
     to `access_management` (CLOUD-01C-C, see
     [docs/architecture/installation-enrollment.md](docs/architecture/installation-enrollment.md#admin-permissions)).
     **Applied**.
  6. [`1786580123456-CreateAuditCore.ts`](libs/database/src/migrations/1786580123456-CreateAuditCore.ts) -
     creates the `audit` schema and its `audit_events` table (CLOUD-01C-D, see
     [docs/architecture/audit.md](docs/architecture/audit.md#data-model)).
     **Not yet applied** - review the migration source before running `pnpm migration:run`.
  7. [`1786580223456-CreateInstallationHealth.ts`](libs/database/src/migrations/1786580223456-CreateInstallationHealth.ts) -
     adds `installation_health` to the existing `installations` schema (CLOUD-01C-D, see
     [docs/architecture/installation-health.md](docs/architecture/installation-health.md#data-model)).
     **Not yet applied** - review the migration source before running `pnpm migration:run`.
  8. [`1786580323456-ExtendAccessManagementRbacForAudit.ts`](libs/database/src/migrations/1786580323456-ExtendAccessManagementRbacForAudit.ts) -
     adds `audit.read` and its role mappings to `access_management` (CLOUD-01C-D, see
     [docs/architecture/audit.md](docs/architecture/audit.md#rbac)).
     **Not yet applied** - review the migration source before running `pnpm migration:run`.

```sh
pnpm migration:create      # scaffold an empty migration file - local, no Docker
pnpm migration:generate    # diff real entity metadata vs. schema and generate a migration - local
pnpm migration:show        # list migrations and their applied state
pnpm migration:run         # apply pending migrations
pnpm migration:revert      # revert the last applied migration
pnpm admin:bootstrap       # create the first AdminUser + grant PLATFORM_ADMIN - requires migrations #2 and #3 applied first
```

`admin:bootstrap` reads `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`/
`BOOTSTRAP_ADMIN_DISPLAY_NAME` from your shell's own environment at invocation time (e.g.
`BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... BOOTSTRAP_ADMIN_DISPLAY_NAME=... pnpm admin:bootstrap`)

- never from any `.env` file, and never logs the password. It refuses to run a second time once any
  AdminUser exists (`409 ADMIN_BOOTSTRAP_ALREADY_COMPLETED`). Like `migration:run`, this is a
  user-run command, not something an assistant executes.

`migration:show`/`run`/`revert` are thin wrappers around `docker compose -f
../infra/docker-compose.yml run --rm --build <service>` (`pos-cloud-migration-show`/
`pos-cloud-migrations`/`pos-cloud-migration-revert` respectively) - see "Migration tooling
services" under Docker above. **Security note**: `migration:show` is read-only and safe for either
the user or an assistant to run; `migration:run` and `migration:revert` change schema and are run
by the user only, never by an assistant. Inside the container, each service runs a `*:internal`
script (`migration:show:internal`/etc., defined in [package.json](package.json)) that invokes
TypeORM directly - kept distinct from the public `migration:*` scripts specifically so the
container's `command:` never re-invokes `docker compose` from inside itself.

`migration:create` and `migration:generate` never go through Docker - they run directly against
`libs/database/src/migrations/`, which lives in a bind-mounted-equivalent source tree either way
(this repo, not a container). `migration:generate` is the one command that needs real TypeORM
entity metadata (not just the migrations table) to diff against PostgreSQL - `apps/migration-tooling`
is a dedicated composition root that imports every bounded context's persistence records (via each
package's `persistence-entities.ts`, a deliberate, documented exception to "persistence internals
are never exported" - see that file's comment) purely so this one command can compare them.
`@pos-cloud/database` itself stays free of any bounded-context dependency, and `apps/api`/
`apps/worker` never import from `apps/migration-tooling` - it exists solely for this CLI command.

## Git rules

This assistant does not run `git add`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`,
`reset`, `checkout`/`switch`, branch deletion, or `gh pr` commands. Only read-only inspection
(`git status`, `git diff`, `git branch --show-current`, ...) is used. All commits, pushes, merges,
and deployments are performed by the user.

## Structure

```
pos-cloud/
├── apps/
│   ├── api/                NestJS HTTP process (composition root - see src/control-plane/)
│   ├── worker/             NestJS application-context (background) process
│   └── migration-tooling/  migration:generate composition root only - see Database/migrations
├── libs/
│   ├── shared-kernel/   Clock/IdGenerator ports, base error taxonomy, pagination - deliberately tiny
│   ├── config/          zod-validated, typed AppConfig, shared by every process
│   ├── database/        TypeORM DataSource + Redis client factories, migration CLI entry point
│   ├── observability/   structured logging (pino), correlation IDs, redaction config
│   ├── messaging/       DomainEvent/ApplicationEvent/EventBus contracts (no broker yet)
│   └── control-plane/
│       ├── customer-management/   Customer aggregate - domain/application/infrastructure/presentation
│       ├── licensing/              License + LicenseEntitlement aggregates
│       ├── installations/          Installation aggregate + InstallationEnrollment/InstallationCredential (CLOUD-01C-C) + installation_health (CLOUD-01C-D)
│       ├── access-management/      AdminUser + AdminSession (CLOUD-01C-A), RBAC/AdminRole (CLOUD-01C-B)
│       └── audit/                  append-only AuditEvent - write sink for every other bounded context (CLOUD-01C-D)
├── docs/
│   ├── architecture/    overview.md, control-plane-core.md, control-plane-data-model.md, admin-authentication.md, admin-rbac.md, installation-enrollment.md, installation-health.md, audit.md
│   └── adr/             ADR-001 .. ADR-015
├── tests/
│   └── architecture/    dependency-cruiser ruleset documentation
├── .env.example
├── Dockerfile            multi-stage: base/deps/build/tooling/prod-deps/runtime
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

Docker Compose itself is not part of this repository - see
[`pos-system/infra/`](../infra/README.md).

## Troubleshooting

- **A process fails immediately on boot with `ConfigValidationError`**: an environment variable is
  missing or invalid (e.g. `APP_PORT` out of range). The error lists the offending variable
  _names_ only, never values - check the external env files under `../config/pos-cloud/`.
- **`docker compose ps` shows a service as `unhealthy`**: check `docker compose logs <service>`
  from `../infra/`. For `pos-cloud-api`/`pos-cloud-worker`, an unhealthy status almost always means
  PostgreSQL or Redis isn't reachable yet - confirm `postgres`/`redis` are themselves `healthy`
  first.
- **`pos-cloud-api`/`pos-cloud-worker` fail with `password authentication failed`**: the
  `pos-cloud-postgres-data` volume was already initialized under different credentials than
  `api.env`/`worker.env` currently declare (`postgres` only applies `POSTGRES_*` env vars on first
  init of an empty volume, never on restart) - see the Troubleshooting section in
  [`pos-system/infra/README.md`](../infra/README.md).
- **`pnpm test:architecture` fails to resolve `@pos-cloud/*` imports**: run `pnpm build` first, so
  each library has a `dist/` for module resolution to follow (see
  [tests/architecture/README.md](tests/architecture/README.md)).
- **Port already in use**: host ports are deliberately non-default (`5433`, `6380`) to avoid a
  local PostgreSQL/Redis install; if `5100` conflicts, another process on the host already uses it.
- **`POST /api/v1/control-plane/customers` (or any business route) fails with a database error**:
  confirm the CLOUD-01B migration is applied with `pnpm migration:show` - it should already show
  `[X] CreateControlPlaneCore1786312046358`. Health endpoints stay fine regardless of migration
  state, since they don't touch the Control Plane tables.

## Roadmap

- **CLOUD-01B** - Control Plane Core: Customer Management, Licensing, Installations. Migration
  applied.
- **CLOUD-01C-A** - Admin Identity & Authentication Foundation: AdminUser, Argon2id,
  JWT access tokens, rotating opaque refresh sessions, `GET /auth/me`, bootstrap tooling. Migration
  applied.
- **CLOUD-01C-B** - RBAC (roles/permissions) on top of Access Management, blanket
  Control Plane route protection, default-deny. Migration applied.
- **CLOUD-01C-C** - Installation Enrollment / Credentials / Activation: one-time
  enrollment codes (INITIAL/RECOVERY), an opaque permanent credential, real `PENDING -> ACTIVE`
  activation, a separate machine identity plane (`/installation-auth/*`). Migrations applied.
- **CLOUD-01C-D** - Installation Heartbeat / Operational Health / Audit Base: computed
  (never persisted) `NEVER_SEEN`/`ONLINE`/`STALE`/`OFFLINE` health, always separate from lifecycle
  status; `POST /installation-health/heartbeat` on the same machine identity plane; a new **Audit**
  bounded context (`audit.read`) recording every real admin/machine action, best-effort, append-only.
  Migrations applied.
- **BACKEND-HARDENING-01** - OpenAPI response contract completeness (every current
  operation's success response now has a real, decorator-wired schema - see
  [ADR-016](docs/adr/ADR-016-openapi-response-contract-and-effective-permissions.md)) and effective
  permissions exposed on `GET /auth/me` (`permissions: string[]`, sorted, resolved via
  `PermissionResolverPort`) - unblocks `pos-cloud-web`'s WEB-01A. No migrations.
- **BACKEND-HARDENING-02** (this state) - Control plane relation display summaries (License/
  Installation admin responses now carry a `customer`/`license` human-facing summary alongside the
  existing machine `customerId`/`licenseId`, via new narrow batched cross-context read ports - no
  N+1, existing IDs unchanged) and the `maxInstallations` concurrent-create race fix (a
  transaction-scoped Postgres advisory lock keyed on `licenseId`, proven with a real concurrent-request
  test, not just a sequential one) - unblocks `pos-cloud-web` rendering Customer/License identity
  without N+1 requests and closes the last confirmed Payment Terminal prerequisite around Installation
  capacity. No migrations.
- **CLOUD-02** - Payment Orchestrator Core
- **CLOUD-03** - Mercado Pago Adapter (behind the Ports/Adapters boundary from
  [ADR-008](docs/adr/ADR-008-provider-integrations-behind-ports-and-adapters.md))

## Backend Backlog

Reviewed and prioritized before any new backend feature work begins:

| Item                                                                                                         | Status                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAPI response contract completeness                                                                       | **RESOLVED** (BACKEND-HARDENING-01)                                                                                                                                                              |
| `/auth/me` effective permissions                                                                             | **RESOLVED** (BACKEND-HARDENING-01)                                                                                                                                                              |
| CORS for `pos-cloud-web`                                                                                     | **CLOSED - NOT REQUIRED** under the frontend's same-origin topology (Vite dev proxy / production reverse proxy). Reopen only if frontend and API are ever deployed genuinely cross-origin.       |
| `maxInstallations` concurrent-create race (`CreateInstallationUseCase`)                                      | **RESOLVED** (BACKEND-HARDENING-02) - Postgres advisory lock keyed on `licenseId`, proven with a real concurrent-request test (`typeorm-installation-creation-unit-of-work.concurrency.spec.ts`) |
| Control plane relation display summaries (License/Installation exposing only raw `customerId`/`licenseId`)   | **RESOLVED** (BACKEND-HARDENING-02)                                                                                                                                                              |
| Heartbeat rate limiting                                                                                      | Open                                                                                                                                                                                             |
| Audit retention/archival policy                                                                              | Open                                                                                                                                                                                             |
| DB-level audit immutability (`REVOKE UPDATE, DELETE` on `audit_events`)                                      | Open                                                                                                                                                                                             |
| Outbox-backed audit delivery                                                                                 | Open                                                                                                                                                                                             |
| Admin login/security-event auditing (login success/failure/lockout/refresh replay)                           | Open                                                                                                                                                                                             |
| Future Admin `SUSPENDED` session revocation semantics (no admin-management feature exists yet to trigger it) | Open                                                                                                                                                                                             |
| Periodic Installation credential rotation                                                                    | Open                                                                                                                                                                                             |
| Worker-based offline-transition detection (if ever required)                                                 | Open                                                                                                                                                                                             |
