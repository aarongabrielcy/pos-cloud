import { randomUUID } from "node:crypto";
import { FixedClock } from "../../test-support/fixed-clock";
import { Customer } from "../../domain/customer";
import { CustomerMapper } from "./customer.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("CustomerMapper", () => {
  it("round-trips a Customer through toRecord/toDomain", () => {
    const original = Customer.create(
      { id: randomUUID(), code: "GST-MX", legalName: "GS Trackme S.A.", tradeName: "GS Trackme" },
      clock,
    );

    const record = CustomerMapper.toRecord(original);
    const rehydrated = CustomerMapper.toDomain(record);

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.code.equals(original.code)).toBe(true);
    expect(rehydrated.legalName.equals(original.legalName)).toBe(true);
    expect(rehydrated.tradeName?.equals(original.tradeName as never)).toBe(true);
    expect(rehydrated.status).toBe(original.status);
    expect(rehydrated.createdAt).toEqual(original.createdAt);
    expect(rehydrated.updatedAt).toEqual(original.updatedAt);
  });

  it("maps a null tradeName both ways", () => {
    const original = Customer.create(
      { id: randomUUID(), code: "ACME01", legalName: "Acme Corp" },
      clock,
    );

    const record = CustomerMapper.toRecord(original);
    expect(record.tradeName).toBeNull();

    const rehydrated = CustomerMapper.toDomain(record);
    expect(rehydrated.tradeName).toBeNull();
  });
});
