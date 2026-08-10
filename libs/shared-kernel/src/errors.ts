/** Base class for errors raised by domain invariants. Framework-free by design. */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Base class for errors raised by application/use-case orchestration. Framework-free by design. */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Generic, reusable error categories shared by every bounded context's application layer, so a
 * presentation-layer error mapper (e.g. a NestJS exception filter) can translate them to HTTP
 * status codes without knowing about any specific bounded context. `code` stays caller-supplied
 * (e.g. "CUSTOMER_CODE_ALREADY_EXISTS") so the HTTP error contract keeps a specific,
 * machine-readable reason per case.
 */
export class NotFoundError extends ApplicationError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ConflictError extends ApplicationError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Raised by domain invariants (value object construction, state transitions). */
export class ValidationError extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
