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

## Enforced rules (minimum set for CLOUD-01A)

| Rule                                                          | What it prevents                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-circular`                                                 | Circular imports anywhere in `apps/` or `libs/`                                                                                                    |
| `libs-cannot-depend-on-apps`                                  | A library reaching into a deployable app - libraries must stay independent so apps can depend on them, never the reverse                           |
| `shared-kernel-is-framework-free`                             | `libs/shared-kernel` importing NestJS, TypeORM, ioredis, Express, Axios, pg, pino, or helmet                                                       |
| `domain-cannot-depend-on-infrastructure`                      | A future `.../domain/...` module importing from a `.../infrastructure/...` module (no domain code exists yet, but the rule is active from day one) |
| `api-cannot-depend-on-worker` / `worker-cannot-depend-on-api` | The two deployable processes reaching into each other directly instead of sharing code through `libs/`                                             |

Because `libs/*` are consumed by `apps/*` as normal workspace packages (resolved through
`node_modules` symlinks to each package's compiled `dist/`, not through TypeScript `paths`), a
deep import like `@pos-cloud/config/src/env.schema` simply does not resolve - only each package's
public `src/index.ts` export surface is importable. This is what "no imports profundos no
públicos" means in practice here, enforced by module resolution itself rather than a bespoke
rule.

Run `pnpm build` first if you are running `pnpm test:architecture` in isolation (outside of
`pnpm validate`) on a fresh checkout, so the `@pos-cloud/*` packages have a `dist/` for module
resolution to follow.
