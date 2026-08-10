import { ConflictError, NotFoundError, ValidationError } from "./errors";

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
});
