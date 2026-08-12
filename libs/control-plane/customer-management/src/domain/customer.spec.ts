import { randomUUID } from "node:crypto";
import { FixedClock } from "../test-support/fixed-clock";
import { CustomerStatus } from "./customer-status";
import { Customer } from "./customer";
import { InvalidCustomerStatusTransitionError } from "./customer.errors";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function createCustomer() {
  return Customer.create(
    { id: randomUUID(), code: "gst-mx", legalName: "GS Trackme S.A.", tradeName: "GS Trackme" },
    clock,
  );
}

describe("Customer", () => {
  it("is created with ACTIVE status", () => {
    expect(createCustomer().status).toBe(CustomerStatus.ACTIVE);
  });

  it("stamps createdAt/updatedAt from the clock", () => {
    const customer = createCustomer();

    expect(customer.createdAt).toEqual(clock.now());
    expect(customer.updatedAt).toEqual(clock.now());
  });

  it("normalizes code and trims names via their value objects", () => {
    const customer = createCustomer();

    expect(customer.code.toString()).toBe("GST-MX");
    expect(customer.legalName.toString()).toBe("GS Trackme S.A.");
    expect(customer.tradeName?.toString()).toBe("GS Trackme");
  });

  it("allows a null tradeName", () => {
    const customer = Customer.create(
      { id: randomUUID(), code: "ACME01", legalName: "Acme Corp" },
      clock,
    );

    expect(customer.tradeName).toBeNull();
  });

  describe("status transitions", () => {
    it("allows ACTIVE -> SUSPENDED", () => {
      const customer = createCustomer();
      customer.changeStatus(CustomerStatus.SUSPENDED, clock);
      expect(customer.status).toBe(CustomerStatus.SUSPENDED);
    });

    it("allows SUSPENDED -> ACTIVE", () => {
      const customer = createCustomer();
      customer.changeStatus(CustomerStatus.SUSPENDED, clock);
      customer.changeStatus(CustomerStatus.ACTIVE, clock);
      expect(customer.status).toBe(CustomerStatus.ACTIVE);
    });

    it("allows ACTIVE -> INACTIVE", () => {
      const customer = createCustomer();
      customer.changeStatus(CustomerStatus.INACTIVE, clock);
      expect(customer.status).toBe(CustomerStatus.INACTIVE);
    });

    it("allows SUSPENDED -> INACTIVE", () => {
      const customer = createCustomer();
      customer.changeStatus(CustomerStatus.SUSPENDED, clock);
      customer.changeStatus(CustomerStatus.INACTIVE, clock);
      expect(customer.status).toBe(CustomerStatus.INACTIVE);
    });

    it("rejects any transition out of INACTIVE - it is terminal", () => {
      const customer = createCustomer();
      customer.changeStatus(CustomerStatus.INACTIVE, clock);

      expect(() => customer.changeStatus(CustomerStatus.ACTIVE, clock)).toThrow(
        InvalidCustomerStatusTransitionError,
      );
      expect(() => customer.changeStatus(CustomerStatus.SUSPENDED, clock)).toThrow(
        InvalidCustomerStatusTransitionError,
      );
    });

    it("rejects a no-op transition to the same status", () => {
      const customer = createCustomer();
      expect(() => customer.changeStatus(CustomerStatus.ACTIVE, clock)).toThrow(
        InvalidCustomerStatusTransitionError,
      );
    });

    it("bumps updatedAt on a successful transition", () => {
      const customer = createCustomer();
      const later = new FixedClock(new Date("2026-02-01T00:00:00.000Z"));

      customer.changeStatus(CustomerStatus.SUSPENDED, later);

      expect(customer.updatedAt).toEqual(later.now());
    });
  });
});
