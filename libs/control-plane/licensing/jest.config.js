/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
  setupFiles: ["reflect-metadata"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts", "!src/index.ts"],
};
