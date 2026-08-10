# syntax=docker/dockerfile:1
# Shared, parameterized Dockerfile for both pos-cloud processes (apps/api, apps/worker), plus a
# `tooling` target used only by ad hoc `docker compose run` migration commands (see
# ../infra/docker-compose.yml). Build with --build-arg APP_NAME=api or --build-arg APP_NAME=worker.

ARG NODE_VERSION=24.19.0

# ---------------------------------------------------------------------------
# base: pin Node + pnpm, nothing else
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: install the full workspace dependency graph, cached by lockfile/manifests
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/migration-tooling/package.json ./apps/migration-tooling/package.json
COPY libs/shared-kernel/package.json ./libs/shared-kernel/package.json
COPY libs/config/package.json ./libs/config/package.json
COPY libs/database/package.json ./libs/database/package.json
COPY libs/observability/package.json ./libs/observability/package.json
COPY libs/messaging/package.json ./libs/messaging/package.json
COPY libs/control-plane/customer-management/package.json ./libs/control-plane/customer-management/package.json
COPY libs/control-plane/licensing/package.json ./libs/control-plane/licensing/package.json
COPY libs/control-plane/installations/package.json ./libs/control-plane/installations/package.json
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build: bring in full source, compile every workspace package with turbo. Kept as its own stage
# (full source + devDependencies, nothing trimmed) so `tooling` can branch off it directly - the
# same image, unmodified, is what migration tooling runs `pnpm exec typeorm-ts-node-commonjs` in.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY apps ./apps
COPY libs ./libs
RUN pnpm build

# ---------------------------------------------------------------------------
# tooling: unmodified build output - full source, full devDependencies (ts-node, the TypeORM CLI).
# Never deployed as a long-running service; only `docker compose run --rm pos-cloud-migration-*`
# (see ../infra/docker-compose.yml) uses this target, always with an explicit `command:` override.
# ---------------------------------------------------------------------------
FROM build AS tooling
USER node
CMD ["sh"]

# ---------------------------------------------------------------------------
# prod-deps: trim devDependencies now that everything is compiled to dist/, and drop source/test
# files that have no purpose in the runtime image (dist/ is what actually runs).
# ---------------------------------------------------------------------------
FROM build AS prod-deps
RUN pnpm install --prod --frozen-lockfile --ignore-scripts \
  && for d in apps/*/ libs/*/; do \
       rm -rf "${d}src" "${d}tsconfig.json" "${d}tsconfig.build.json" "${d}jest.config.js"; \
     done

# ---------------------------------------------------------------------------
# runtime: minimal image with only compiled output + production node_modules
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ARG APP_NAME
ENV NODE_ENV=production
# Deliberately NOT named APP_NAME: the application's own config schema (libs/config) also defines
# an APP_NAME variable (the service's logical name for logging, e.g. "pos-cloud-api"), supplied at
# runtime via env_file. Reusing the same name here would let that runtime value silently override
# this build-time process selector and break the CMD path below.
ENV POS_CLOUD_PROCESS=${APP_NAME}
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/libs ./libs
COPY --from=prod-deps /app/apps/${APP_NAME} ./apps/${APP_NAME}

USER node

CMD ["sh", "-c", "node apps/${POS_CLOUD_PROCESS}/dist/main.js"]
