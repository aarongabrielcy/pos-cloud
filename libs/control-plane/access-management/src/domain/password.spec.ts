import { InvalidAdminPasswordError } from "./admin-user.errors";
import { Password } from "./password";

describe("Password", () => {
  it("accepts a 12-character password", () => {
    expect(Password.create("a".repeat(12)).reveal()).toBe("a".repeat(12));
  });

  it("accepts a 256-character password", () => {
    expect(Password.create("a".repeat(256)).reveal()).toBe("a".repeat(256));
  });

  it("rejects a password shorter than 12 characters", () => {
    expect(() => Password.create("a".repeat(11))).toThrow(InvalidAdminPasswordError);
  });

  it("rejects a password longer than 256 characters", () => {
    expect(() => Password.create("a".repeat(257))).toThrow(InvalidAdminPasswordError);
  });

  it("does not impose composition rules (no uppercase/digit/symbol required)", () => {
    expect(Password.create("all-lowercase-and-long-enough").reveal()).toBe(
      "all-lowercase-and-long-enough",
    );
  });
});
