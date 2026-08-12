import { InstallationCode } from "./installation-code";
import { InvalidInstallationCodeError } from "./installation.errors";

describe("InstallationCode", () => {
  it("normalizes via trim and uppercase", () => {
    expect(InstallationCode.create("  pos-gst-00001  ").toString()).toBe("POS-GST-00001");
  });

  it("rejects a code shorter than 5 characters", () => {
    expect(() => InstallationCode.create("AB12")).toThrow(InvalidInstallationCodeError);
  });

  it("accepts a valid code", () => {
    expect(() => InstallationCode.create("POS-GST-00001")).not.toThrow();
  });
});
