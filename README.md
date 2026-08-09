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

## Status: CLOUD-01A - Cloud Foundation

This is infrastructure, not features. No commercial bounded context (Customer, License,
Installation, Payment, Terminal, ...) exists yet. What exists is the professional foundation those
tasks will be built on: monorepo, processes, database/cache wiring, configuration, observability,
health checks, architecture enforcement, and Docker development environment.

Mercado Pago and the Point A910 terminal are **not implemented here** - they arrive later as a
Payment Orchestrator adapter (CLOUD-03), behind a Ports/Adapters boundary
([ADR-008](docs/adr/ADR-008-provider-integrations-behind-ports-and-adapters.md)). Payment
Orchestrator itself is **planned**, not implemented, in this repository state.

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
  cross-context joins ([ADR-007](docs/adr/ADR-007-bounded-context-data-ownership.md)).
- Enforced by code, not just documentation: `pnpm test:architecture` runs dependency-cruiser
  against the real import graph and fails the build on a real violation - see
  [tests/architecture/README.md](tests/architecture/README.md).

All ADRs: [docs/adr/](docs/adr/).

## Processes

Two deployable processes of the same modular monolith
([ADR-004](docs/adr/ADR-004-separate-api-and-worker-deployables.md)):

| Process       | What it is                                        | What it does in CLOUD-01A                                                                                                                                                                                              |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`    | NestJS HTTP process                               | `/health`, `/health/live`, `/health/ready`; helmet; global `ValidationPipe`; structured logging with correlation IDs; graceful shutdown. No auth yet.                                                                  |
| `apps/worker` | NestJS application-context process (no HTTP port) | Loads config, connects PostgreSQL + Redis, stays alive on those connections, shuts down cleanly on SIGTERM/SIGINT. No business jobs yet - ships a standalone `dist/healthcheck.js` for Docker instead of an HTTP port. |

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
`pos-system/pos-cloud/`). `docker-compose.yml` consumes these directly via `env_file`. They are
never copied into the repo, never logged, never committed
([ADR-006](docs/adr/ADR-006-external-configuration-and-secrets.md)).

This repo only ships [.env.example](.env.example) - variable **names** with non-sensitive
placeholders, for reference and for running a process directly on the host (outside Docker).

**Container networking note**: inside `docker-compose.yml`, `DATABASE_HOST`/`DATABASE_PORT` and
`REDIS_HOST`/`REDIS_PORT` are pinned explicitly to the compose service names and internal ports
(`postgres:5432`, `redis:6379`) via each service's `environment:` block, overriding whatever
`infrastructure.env` sets for other run modes. Credentials (`DATABASE_USER`, `DATABASE_PASSWORD`,
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

CLI only - no Docker Desktop UI, no Kubernetes, no Swarm, no registry push.

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f pos-cloud-api
docker compose down            # never `down -v` - that would drop the named volumes
```

Services: `postgres` (`postgres:16-alpine`), `redis` (`redis:7-alpine`), `pos-cloud-api`,
`pos-cloud-worker`, all on the `pos-cloud-network` network. Named volumes
`pos-cloud-postgres-data` and `pos-cloud-redis-data` persist data across restarts.

Host ports (chosen to avoid clashing with a local PostgreSQL/Redis install):

- API: `5100:5100`
- PostgreSQL: `5433:5432` (debug access only; the API/worker containers talk to `postgres:5432`
  over the compose network)
- Redis: `6380:6379` (debug access only; containers talk to `redis:6379`)

Both `pos-cloud-api` and `pos-cloud-worker` images are built from the single parameterized
[infrastructure/docker/Dockerfile](infrastructure/docker/Dockerfile) (`--build-arg APP_NAME=api`
or `worker`), run as the non-root `node` user, and are multi-stage so the runtime image ships
compiled `dist/` output and production dependencies only.

## Health endpoints

| Endpoint            | Meaning                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health/live`  | Process is alive. No dependency is checked.                                                                                                         |
| `GET /health/ready` | Real readiness: PostgreSQL (`SELECT 1` via the TypeORM DataSource) and Redis (`PING`) are both checked. Returns a non-2xx status if either is down. |
| `GET /health`       | Aggregate health, equivalent to `/health/ready`, kept for operator convenience.                                                                     |

The worker has no HTTP port; its Docker healthcheck runs `apps/worker/dist/healthcheck.js`, a
standalone script (no Nest bootstrap) that checks PostgreSQL and Redis the same way and exits 0/1.

## Database / migrations

- TypeORM, PostgreSQL 16.
- **`synchronize: false` and `migrationsRun: false` always** - in every environment, with no
  override. Schema changes only happen through a migration the user runs explicitly
  ([ADR-005](docs/adr/ADR-005-postgresql-and-redis.md)).
- A single reusable `DataSource` configuration (`libs/database`) is shared by `apps/api`,
  `apps/worker`, and the migration CLI.
- No business tables and no migrations exist yet. Migration tooling is prepared, not used:

```sh
pnpm migration:create      # scaffold an empty migration file
pnpm migration:generate    # diff entities vs. schema and generate a migration
pnpm migration:show        # list migrations and their applied state
pnpm migration:run         # apply pending migrations
pnpm migration:revert      # revert the last applied migration
```

**Only the user runs `migration:run` / `migration:revert`.** These commands are documented and
wired up, not executed as part of this task.

## Git rules

This assistant does not run `git add`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`,
`reset`, `checkout`/`switch`, branch deletion, or `gh pr` commands. Only read-only inspection
(`git status`, `git diff`, `git branch --show-current`, ...) is used. All commits, pushes, merges,
and deployments are performed by the user.

## Structure

```
pos-cloud/
├── apps/
│   ├── api/            NestJS HTTP process
│   └── worker/         NestJS application-context (background) process
├── libs/
│   ├── shared-kernel/   Clock port, base Domain/Application error types - deliberately tiny
│   ├── config/          zod-validated, typed AppConfig, shared by every process
│   ├── database/        TypeORM DataSource + Redis client factories, migration CLI entry point
│   ├── observability/   structured logging (pino), correlation IDs, redaction config
│   └── messaging/       DomainEvent/ApplicationEvent/EventBus contracts (no broker yet)
├── docs/
│   ├── architecture/    overview.md with Mermaid diagrams
│   └── adr/             ADR-001 .. ADR-008
├── infrastructure/
│   └── docker/          shared, parameterized Dockerfile
├── tests/
│   └── architecture/    dependency-cruiser ruleset documentation
├── .env.example
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Troubleshooting

- **A process fails immediately on boot with `ConfigValidationError`**: an environment variable is
  missing or invalid (e.g. `APP_PORT` out of range). The error lists the offending variable
  _names_ only, never values - check the external env files under `../config/pos-cloud/`.
- **`docker compose ps` shows a service as `unhealthy`**: check `docker compose logs <service>`.
  For `pos-cloud-api`/`pos-cloud-worker`, an unhealthy status almost always means PostgreSQL or
  Redis isn't reachable yet - confirm `postgres`/`redis` are themselves `healthy` first.
- **`pnpm test:architecture` fails to resolve `@pos-cloud/*` imports**: run `pnpm build` first, so
  each library has a `dist/` for module resolution to follow (see
  [tests/architecture/README.md](tests/architecture/README.md)).
- **Port already in use**: host ports are deliberately non-default (`5433`, `6380`) to avoid a
  local PostgreSQL/Redis install; if `5100` conflicts, another process on the host already uses it.

## Roadmap

- **CLOUD-01B** - Control Plane Core (first real domain models and migrations)
- **CLOUD-01C** - Installation Authentication / Health / Audit
- **CLOUD-02** - Payment Orchestrator Core
- **CLOUD-03** - Mercado Pago Adapter (behind the Ports/Adapters boundary from
  [ADR-008](docs/adr/ADR-008-provider-integrations-behind-ports-and-adapters.md))
