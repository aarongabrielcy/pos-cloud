import { isInstallationEligibleForEnrollment } from "./installation-enrollment-eligibility";
import { InstallationEnrollmentPurpose } from "./installation-enrollment-purpose";
import { InstallationStatus } from "./installation-status";

describe("isInstallationEligibleForEnrollment", () => {
  it.each([
    [InstallationStatus.PENDING, true],
    [InstallationStatus.ACTIVE, false],
    [InstallationStatus.SUSPENDED, false],
    [InstallationStatus.DECOMMISSIONED, false],
  ])("INITIAL + %s -> %s", (status, expected) => {
    expect(isInstallationEligibleForEnrollment(status, InstallationEnrollmentPurpose.INITIAL)).toBe(
      expected,
    );
  });

  it.each([
    [InstallationStatus.PENDING, false],
    [InstallationStatus.ACTIVE, true],
    [InstallationStatus.SUSPENDED, true],
    [InstallationStatus.DECOMMISSIONED, false],
  ])("RECOVERY + %s -> %s", (status, expected) => {
    expect(
      isInstallationEligibleForEnrollment(status, InstallationEnrollmentPurpose.RECOVERY),
    ).toBe(expected);
  });
});
