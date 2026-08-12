# ADR-011: OpenAPI as the Contract Between pos-cloud and pos-admin-web

## Status

Accepted

## Context

The Control Plane HTTP API introduced in CLOUD-01B needs a future administrative frontend
(`pos-admin-web`) to manage customers, licenses, and installations. That frontend does not exist
yet and is explicitly out of scope for this task (no React/Vite/Next added to this repository, no
frontend repository created). Even so, the _shape_ of the integration needs to be decided now so
API design (DTOs, response envelopes, error contract) doesn't accidentally paint the backend into a
corner that's awkward for a generated client.

## Decision

- `pos-cloud` (this repository) and `pos-admin-web` (future, separate repository/deployable) never
  share TypeScript source. No shared npm package of DTOs, no monorepo merge.
- The integration contract is **OpenAPI**, generated at runtime by `@nestjs/swagger` from live
  controller/DTO decorators - `GET /openapi.json` always reflects the actual running API, and there
  is no hand-maintained or checked-in static OpenAPI file to drift from the code.
  `SwaggerModule.setup("docs", ...)` also serves interactive Swagger UI at `/docs`.
  Both are enabled by default outside `NODE_ENV=production` (see
  `apps/api/src/main.ts`) - production exposure is a deliberate, separate configuration decision,
  not made in this task (see the security note below).
- `pos-admin-web`, when it is built, generates its API client from `/openapi.json` (e.g. via
  `openapi-typescript` or an equivalent generator) rather than hand-writing fetch calls - this ADR
  fixes the _source of truth_ (the running API's decorators), not the specific generator tool.
- DTOs and controllers are written to produce a genuinely useful schema: explicit `@ApiProperty`/
  `@ApiPropertyOptional` on every request/response field, `@ApiTags`/`@ApiOperation` on every
  route, enums exposed as real OpenAPI enums (not bare strings) - see any DTO under
  `libs/control-plane/*/src/presentation/http/dto/`.

## Security note

The Control Plane API has no authentication yet (that is CLOUD-01C+ scope). Both `/docs` and
`/openapi.json` are therefore unauthenticated in this task's state, same as every other business
route. **DO NOT DEPLOY PUBLICLY** - see the README's security section. This is not a Swagger-specific
risk; it's the general state of an API with no auth layer yet, called out here because `/docs`
would be the most visible unauthenticated surface to accidentally expose.

## Consequences

- Frontend and backend can evolve independently; a backend DTO change that breaks the contract is
  visible immediately as an OpenAPI diff, not discovered at runtime in the frontend.
- No hand-maintained OpenAPI file to fall out of sync - the tradeoff is that the schema's quality
  depends on API authors keeping decorators accurate and complete, an ongoing discipline rather
  than a one-time decision.
- `pos-admin-web`'s creation and its generated-client tooling choice are deferred to a future task;
  this ADR only fixes that OpenAPI (not a shared TS package, not GraphQL, not gRPC) is the contract
  mechanism.
