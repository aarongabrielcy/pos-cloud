/**
 * Raised when environment configuration fails validation at startup. Deliberately fail-fast:
 * the process must not boot with an invalid or incomplete configuration.
 */
export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "ConfigValidationError";
  }
}
