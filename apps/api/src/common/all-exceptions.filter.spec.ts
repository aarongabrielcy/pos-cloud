import type { ArgumentsHost } from "@nestjs/common";
import { ForbiddenError, UnauthorizedError } from "@pos-cloud/shared-kernel";
import type { PinoLogger } from "nestjs-pino";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function buildHost(request: { id?: string }): {
  host: ArgumentsHost;
  response: { status: jest.Mock; json: jest.Mock };
} {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe("AllExceptionsFilter - auth error mapping", () => {
  const fakeLogger = {
    setContext: () => undefined,
    error: () => undefined,
  } as unknown as PinoLogger;

  it("maps UnauthorizedError to 401 with the shared error contract", () => {
    const filter = new AllExceptionsFilter(fakeLogger);
    const { host, response } = buildHost({ id: "corr-1" });

    filter.catch(new UnauthorizedError("INVALID_CREDENTIALS", "Invalid credentials"), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
      correlationId: "corr-1",
    });
  });

  it("maps ForbiddenError to 403 with the shared error contract", () => {
    const filter = new AllExceptionsFilter(fakeLogger);
    const { host, response } = buildHost({ id: "corr-2" });

    filter.catch(new ForbiddenError("FORBIDDEN", "Not allowed"), host);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Not allowed",
      correlationId: "corr-2",
    });
  });

  it("does not break the existing 400/404/409/500 mappings", () => {
    const filter = new AllExceptionsFilter(fakeLogger);
    const { host, response } = buildHost({ id: "corr-3" });

    filter.catch(new Error("boom"), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      correlationId: "corr-3",
    });
  });

  it("never logs SQL query/parameters or driver error detail for a QueryFailedError-shaped exception", () => {
    // Regression test: a real 500 (correlation id 61dea442-f01a-4785-8a86-c9e1ea96ed14) logged
    // err.query, err.parameters (a refresh_token_hash), and driverError - Pino's default error
    // serializer copies every own enumerable property of the raw exception. Shaped exactly like
    // TypeORM's QueryFailedError (see typeorm/error/QueryFailedError.js: query/parameters/driverError
    // are own enumerable instance properties) without importing typeorm here, so this stays generic.
    const errorSpy = jest.fn();
    const spyLogger = { setContext: () => undefined, error: errorSpy } as unknown as PinoLogger;
    const filter = new AllExceptionsFilter(spyLogger);
    const { host, response } = buildHost({ id: "corr-4" });

    const queryFailedLike = new Error(
      'duplicate key value violates unique constraint "admin_users_email_key"',
    );
    Object.assign(queryFailedLike, {
      query:
        "INSERT INTO access_management.admin_sessions (id, refresh_token_hash) VALUES ($1, $2)",
      parameters: ["11111111-1111-4111-8111-111111111111", "super-secret-refresh-token-hash"],
      driverError: {
        code: "23505",
        constraint: "admin_users_email_key",
        table: "admin_users",
        schema: "access_management",
        detail: "Key (email)=(root@example.com) already exists.",
      },
    });

    filter.catch(queryFailedLike, host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [loggedPayload] = errorSpy.mock.calls[0] as [{ err: Record<string, unknown> }];
    const serialized = JSON.stringify(loggedPayload);

    expect(serialized).not.toContain("super-secret-refresh-token-hash");
    expect(serialized).not.toContain("root@example.com");
    expect(serialized).not.toContain("INSERT INTO");
    expect(loggedPayload.err.query).toBeUndefined();
    expect(loggedPayload.err.parameters).toBeUndefined();
    expect(loggedPayload.err.driverError).toBeUndefined();
    expect(loggedPayload.err.postgresCode).toBe("23505");
    expect(loggedPayload.err.constraint).toBe("admin_users_email_key");
    expect(loggedPayload.err.table).toBe("admin_users");
    expect(loggedPayload.err.schema).toBe("access_management");
  });
});
