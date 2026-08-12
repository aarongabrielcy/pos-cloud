import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors";

describe("shared error taxonomy", () => {
  it("NotFoundError carries a caller-supplied code and message", () => {
    const error = new NotFoundError("CUSTOMER_NOT_FOUND", "Customer not found");

    expect(error.code).toBe("CUSTOMER_NOT_FOUND");
    expect(error.message).toBe("Customer not found");
    expect(error).toBeInstanceOf(Error);
  });

  it("ConflictError carries a caller-supplied code and message", () => {
    const error = new ConflictError("CUSTOMER_CODE_ALREADY_EXISTS", "Customer code already exists");

    expect(error.code).toBe("CUSTOMER_CODE_ALREADY_EXISTS");
  });

  it("ValidationError carries a caller-supplied code and message", () => {
    const error = new ValidationError("INVALID_CUSTOMER_CODE", "Invalid customer code");

    expect(error.code).toBe("INVALID_CUSTOMER_CODE");
  });

  it("UnauthorizedError carries a caller-supplied code and message", () => {
    const error = new UnauthorizedError("INVALID_CREDENTIALS", "Invalid credentials");

    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(error.message).toBe("Invalid credentials");
    expect(error).toBeInstanceOf(Error);
  });

  it("ForbiddenError carries a caller-supplied code and message", () => {
    const error = new ForbiddenError("FORBIDDEN", "Not allowed");

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("Not allowed");
    expect(error).toBeInstanceOf(Error);
  });
});
