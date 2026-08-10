# Architecture tests

Dependency direction is enforced automatically with [dependency-cruiser](https://github.com/sverweij/dependency-cruiser),
configured at the repo root in [.dependency-cruiser.cjs](../../.dependency-cruiser.cjs) and run
via:

```
pnpm test:architecture
```

The command runs from the repo root (not from this directory) so the shared
`.dependency-cruiser.cjs` and `tsconfig.base.json` resolve relative to a single, predictable
working directory regardless of which package triggered the check.

The scan roots are each package's `src/` directory (`apps/*/src`, `libs/*/src`,
`libs/control-plane/*/src`), not the package root - see "Resolution notes" below for why.

## Enforced rules

| Rule                                                          | What it prevents                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-circular`                                                 | Circular imports anywhere in the scanned tree                                                                                                      |
| `libs-cannot-depend-on-apps`                                  | A library reaching into a deployable app                                                                                                           |
| `shared-kernel-is-framework-free`                             | `libs/shared-kernel` importing NestJS, TypeORM, ioredis, Express, Axios, pg, pino, or helmet                                                       |
| `domain-cannot-depend-on-infrastructure`                      | Any `.../domain/...` module importing from a `.../infrastructure/...` module                                                                       |
| `domain-cannot-depend-on-application`                         | Any `.../domain/...` module importing from a `.../application/...` module                                                                          |
| `domain-cannot-depend-on-presentation`                        | Any `.../domain/...` module importing from a `.../presentation/...` module                                                                         |
| `application-cannot-depend-on-infrastructure`                 | Any `.../application/...` module importing from a `.../infrastructure/...` module                                                                  |
| `application-cannot-depend-on-presentation`                   | Any `.../application/...` module importing from a `.../presentation/...` module                                                                    |
| `domain-is-framework-free`                                    | Any bounded context's `domain/` folder importing NestJS, TypeORM, ioredis, Express, Axios, pg, pino, helmet, class-validator, or class-transformer |
| `customer-management-cannot-import-other-bounded-contexts`    | `@pos-cloud/customer-management` importing `@pos-cloud/licensing` or `@pos-cloud/installations`                                                    |
| `licensing-cannot-import-other-bounded-contexts`              | `@pos-cloud/licensing` importing `@pos-cloud/customer-management` or `@pos-cloud/installations`                                                    |
| `installations-cannot-import-other-bounded-contexts`          | `@pos-cloud/installations` importing `@pos-cloud/customer-management` or `@pos-cloud/licensing`                                                    |
| `api-cannot-depend-on-worker` / `worker-cannot-depend-on-api` | The two deployable processes reaching into each other directly instead of sharing code through `libs/`                                             |

Every rule above was verified to actually fail the build against a real, temporarily-introduced
violation before being kept (per CLOUD-01B's requirement) - see the ADR-009/ADR-010 discussion in
[docs/architecture/control-plane-core.md](../../docs/architecture/control-plane-core.md) for the
cross-bounded-context rule in particular.

## Public API boundary (no deep imports)

Because `libs/*` are consumed by `apps/*`/other packages as normal workspace packages (resolved
through `node_modules` symlinks, not through TypeScript `paths`), a deep import like
`@pos-cloud/customer-management/src/infrastructure/...` simply does not resolve - only each
package's public `src/index.ts` export surface is importable. Persistence records, TypeORM
repositories, and HTTP controllers/DTOs are intentionally never re-exported from a bounded
context's `index.ts`.

## Resolution notes (why the scan roots are `src/`, not the package root)

pnpm workspace package imports (e.g. `@pos-cloud/licensing` from another package) resolve through
a `node_modules/@pos-cloud/<pkg>` symlink, but dependency-cruiser reports the **realpath** the
symlink points to - the package's actual compiled output, e.g.
`libs/control-plane/licensing/dist/index.js` - not a `node_modules/...`-prefixed path. Two
consequences that shaped this config:

- Rules matching cross-bounded-context imports (or `libs-cannot-depend-on-apps`, etc.) must match
  against `^libs/control-plane/<pkg>` (the realpath form), not `node_modules/@pos-cloud/<pkg>`.
- An earlier version of this config excluded `dist/` broadly (`exclude: { path: "...dist..." }`)
  to keep compiled output out of the scan. That also silently dropped every cross-package edge,
  since the edge's resolved target _is_ a `dist/` path - rule violations went undetected with zero
  error output. Scanning `src/` directories directly (instead of whole packages, then excluding
  `dist`) avoids the ambiguity: compiled output is never a scan root, but a resolved dependency
  pointing into another package's `dist/` is still recorded as an edge (just not recursed into,
  via `doNotFollow: { path: "(node_modules|libs/.+/dist)" }`), so the isolation rules can see and
  reject it.

Run `pnpm build` first if you are running `pnpm test:architecture` in isolation (outside of
`pnpm validate`) on a fresh checkout, so the `@pos-cloud/*` packages have a `dist/` for module
resolution to follow.
