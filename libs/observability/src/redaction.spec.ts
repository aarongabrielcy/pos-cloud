import { REDACTED_PATHS, SENSITIVE_FIELD_NAMES } from "./redaction";

describe("redaction configuration", () => {
  it.each(SENSITIVE_FIELD_NAMES)("configures a redaction path for %s", (field) => {
    expect(REDACTED_PATHS).toContain(field);
    expect(REDACTED_PATHS).toContain(`req.headers.${field}`);
  });

  it("covers the minimum mandated sensitive fields", () => {
    const required = [
      "authorization",
      "cookie",
      "set-cookie",
      "password",
      "access_token",
      "refresh_token",
      "client_secret",
    ];

    for (const field of required) {
      expect(SENSITIVE_FIELD_NAMES).toContain(field);
    }
  });
});
