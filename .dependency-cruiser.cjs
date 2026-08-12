/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular imports make module boundaries and initialization order unpredictable.",
      from: {},
      to: { circular: true },
    },
    {
      name: "libs-cannot-depend-on-apps",
      severity: "error",
      comment:
        "Libraries must stay independent of any deployable process. Apps depend on libs, never the reverse - this is what keeps future microservice extraction possible.",
      from: { path: "^libs" },
      to: { path: "^apps" },
    },
    {
      name: "shared-kernel-is-framework-free",
      severity: "error",
      comment:
        "shared-kernel must stay free of NestJS/TypeORM/Redis/HTTP/PostgreSQL frameworks so future domain code built on it never absorbs an infrastructure dependency.",
      from: { path: "^libs/shared-kernel" },
      to: {
        path: "node_modules/(@nestjs|typeorm|ioredis|express|axios|pg|pino|helmet|nestjs-pino)",
      },
    },
    {
      name: "domain-cannot-depend-on-infrastructure",
      severity: "error",
      comment:
        "Domain layers must never import from an infrastructure layer - only the reverse (infrastructure implements ports defined inward).",
      from: { path: "/domain/" },
      to: { path: "/infrastructure/" },
    },
    {
      name: "domain-cannot-depend-on-application",
      severity: "error",
      comment: "Domain must not depend on Application - dependencies point Presentation -> Application -> Domain.",
      from: { path: "/domain/" },
      to: { path: "/application/" },
    },
    {
      name: "domain-cannot-depend-on-presentation",
      severity: "error",
      comment: "Domain must not depend on Presentation (HTTP controllers/DTOs).",
      from: { path: "/domain/" },
      to: { path: "/presentation/" },
    },
    {
      name: "application-cannot-depend-on-infrastructure",
      severity: "error",
      comment:
        "Application may depend on Domain and on ports it defines, never on a concrete Infrastructure implementation (e.g. a TypeORM repository class).",
      from: { path: "/application/" },
      to: { path: "/infrastructure/" },
    },
    {
      name: "application-cannot-depend-on-presentation",
      severity: "error",
      comment: "Application must not depend on Presentation (HTTP controllers/DTOs).",
      from: { path: "/application/" },
      to: { path: "/presentation/" },
    },
    {
      name: "domain-is-framework-free",
      severity: "error",
      comment:
        "Domain layers (Customer, License, Installation, ...) must stay free of NestJS/TypeORM/Redis/HTTP/validation frameworks - the same rule as shared-kernel, applied to every bounded context's domain/ folder.",
      from: { path: "/domain/" },
      to: {
        path: "node_modules/(@nestjs|typeorm|ioredis|express|axios|pg|pino|helmet|nestjs-pino|class-validator|class-transformer)",
      },
    },
    {
      name: "customer-management-cannot-import-other-bounded-contexts",
      severity: "error",
      comment:
        "Bounded contexts never import each other directly - only apps/api (the composition root) may depend on more than one context's public API, wiring the cross-context ports. Workspace package imports resolve to their real source path (pnpm symlinks are realpath-resolved), e.g. libs/control-plane/licensing/dist/index.js - not a node_modules/@pos-cloud/... path.",
      from: { path: "^libs/control-plane/customer-management" },
      to: { path: "^libs/control-plane/(licensing|installations|access-management)" },
    },
    {
      name: "licensing-cannot-import-other-bounded-contexts",
      severity: "error",
      comment:
        "Bounded contexts never import each other directly - only apps/api (the composition root) may depend on more than one context's public API, wiring the cross-context ports.",
      from: { path: "^libs/control-plane/licensing" },
      to: { path: "^libs/control-plane/(customer-management|installations|access-management)" },
    },
    {
      name: "installations-cannot-import-other-bounded-contexts",
      severity: "error",
      comment:
        "Bounded contexts never import each other directly - only apps/api (the composition root) may depend on more than one context's public API, wiring the cross-context ports.",
      from: { path: "^libs/control-plane/installations" },
      to: { path: "^libs/control-plane/(customer-management|licensing|access-management)" },
    },
    {
      name: "access-management-cannot-import-other-bounded-contexts",
      severity: "error",
      comment:
        "Bounded contexts never import each other directly - only apps/api (the composition root) may depend on more than one context's public API, wiring the cross-context ports. Access Management (CLOUD-01C-A) does not need any cross-context port yet - see docs/architecture/admin-authentication.md.",
      from: { path: "^libs/control-plane/access-management" },
      to: { path: "^libs/control-plane/(customer-management|licensing|installations)" },
    },
    {
      name: "api-cannot-depend-on-worker",
      severity: "error",
      comment:
        "apps/api and apps/worker are independent deployables of the same modular monolith; they may only share code through libs.",
      from: { path: "^apps/api" },
      to: { path: "^apps/worker" },
    },
    {
      name: "worker-cannot-depend-on-api",
      severity: "error",
      comment:
        "apps/api and apps/worker are independent deployables of the same modular monolith; they may only share code through libs.",
      from: { path: "^apps/worker" },
      to: { path: "^apps/api" },
    },
  ],
  options: {
    // Third-party deps resolve into node_modules; workspace packages resolve to their real
    // source path (e.g. libs/control-plane/licensing/dist/index.js) since pnpm symlinks are
    // realpath-resolved - both are recorded as edges (so rules can check them) but not recursed
    // into, so the graph doesn't balloon with another package's compiled internals.
    doNotFollow: {
      path: "(node_modules|libs/.+/dist)",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["require", "node", "default"],
    },
  },
};
