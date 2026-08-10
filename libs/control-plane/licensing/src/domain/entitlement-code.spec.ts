import { EntitlementCode } from "./entitlement-code";
import { InvalidEntitlementCodeError } from "./license.errors";

describe("EntitlementCode", () => {
  it.each(["integrated_payments", "cloud_backup", "multi_device"])("accepts %s", (code) => {
    expect(() => EntitlementCode.create(code)).not.toThrow();
  });

  it("rejects uppercase", () => {
    expect(() => EntitlementCode.create("Integrated_Payments")).toThrow(
      InvalidEntitlementCodeError,
    );
  });

  it("rejects a code starting with a digit", () => {
    expect(() => EntitlementCode.create("1payments")).toThrow(InvalidEntitlementCodeError);
  });

  it("rejects a code shorter than 3 characters", () => {
    expect(() => EntitlementCode.create("ab")).toThrow(InvalidEntitlementCodeError);
  });
});
