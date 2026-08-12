import { InvalidAdminEmailError } from "./admin-user.errors";
import { Email } from "./email";

describe("Email", () => {
  it("trims and lowercases", () => {
    expect(Email.create("  Admin@Example.COM  ").toString()).toBe("admin@example.com");
  });

  it("rejects an obviously malformed address", () => {
    expect(() => Email.create("not-an-email")).toThrow(InvalidAdminEmailError);
  });

  it("rejects an empty string", () => {
    expect(() => Email.create("   ")).toThrow(InvalidAdminEmailError);
  });

  it("two normalized-equal emails are equal regardless of original casing", () => {
    const a = Email.create("Admin@Example.com");
    const b = Email.create("admin@example.com");
    expect(a.equals(b)).toBe(true);
  });
});
