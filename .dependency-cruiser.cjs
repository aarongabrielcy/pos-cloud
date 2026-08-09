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
        "Domain layers (once they exist) must never import from an infrastructure layer - only the reverse (infrastructure implements ports defined inward).",
      from: { path: "/domain/" },
      to: { path: "/infrastructure/" },
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
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)(dist|coverage|\\.turbo)(/|$)",
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
