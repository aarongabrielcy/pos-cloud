// Some spec files import ControlPlaneModule (directly or transitively), which imports
// AuthConfigModule - its `AUTH_CONFIG` provider calls loadAuthConfig() the moment the module class
// is decorated (i.e. at import time, not at Test.createTestingModule().compile() time), so the only
// variable with no default (AUTH_JWT_SECRET) must already exist in process.env before any spec file
// is required. Jest's `setupFiles` runs before that, unlike code inside a test file itself. Never
// overrides a real value if one is already set.
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || "jest-test-secret-at-least-32-characters-long";
