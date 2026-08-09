/**
 * Field names that must never appear unredacted in logs, even before the corresponding feature
 * (auth, payments, etc.) exists. Keeping this list ahead of the features prevents a future
 * integration from accidentally logging a secret before redaction catches up.
 */
export const SENSITIVE_FIELD_NAMES = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "access_token",
  "refresh_token",
  "client_secret",
] as const;

function pinoPathsFor(field: string): string[] {
  return [
    field,
    `*.${field}`,
    `req.headers.${field}`,
    `res.headers.${field}`,
    `req.body.${field}`,
    `body.${field}`,
  ];
}

export const REDACTED_PATHS: string[] = SENSITIVE_FIELD_NAMES.flatMap(pinoPathsFor);

export const REDACTION_CENSOR = "[REDACTED]";
