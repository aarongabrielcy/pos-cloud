import { LicenseNumber } from "./license-number";
import { InvalidLicenseNumberError } from "./license.errors";

describe("LicenseNumber", () => {
  it("normalizes via trim and uppercase", () => {
    expect(LicenseNumber.create("  lic-gst-00001  ").toString()).toBe("LIC-GST-00001");
  });

  it("rejects a number shorter than 5 characters", () => {
    expect(() => LicenseNumber.create("AB12")).toThrow(InvalidLicenseNumberError);
  });

  it("rejects a number longer than 80 characters", () => {
    expect(() => LicenseNumber.create("A".repeat(81))).toThrow(InvalidLicenseNumberError);
  });

  it("accepts a valid number", () => {
    expect(() => LicenseNumber.create("LIC-GST-00001")).not.toThrow();
  });
});
