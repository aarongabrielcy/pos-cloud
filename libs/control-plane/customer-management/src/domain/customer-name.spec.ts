import { CustomerName } from "./customer-name";
import { InvalidCustomerLegalNameError, InvalidCustomerTradeNameError } from "./customer.errors";

describe("CustomerName", () => {
  describe("createLegalName", () => {
    it("trims whitespace", () => {
      expect(CustomerName.createLegalName("  Acme S.A.  ").toString()).toBe("Acme S.A.");
    });

    it("rejects fewer than 2 characters", () => {
      expect(() => CustomerName.createLegalName("A")).toThrow(InvalidCustomerLegalNameError);
    });

    it("rejects more than 200 characters", () => {
      expect(() => CustomerName.createLegalName("A".repeat(201))).toThrow(
        InvalidCustomerLegalNameError,
      );
    });
  });

  describe("createTradeName", () => {
    it("accepts a single character", () => {
      expect(() => CustomerName.createTradeName("A")).not.toThrow();
    });

    it("rejects an empty string", () => {
      expect(() => CustomerName.createTradeName("")).toThrow(InvalidCustomerTradeNameError);
    });

    it("rejects more than 200 characters", () => {
      expect(() => CustomerName.createTradeName("A".repeat(201))).toThrow(
        InvalidCustomerTradeNameError,
      );
    });
  });
});
