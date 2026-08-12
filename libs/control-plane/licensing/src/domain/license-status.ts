export enum LicenseStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
}

/**
 * ACTIVE <-> SUSPENDED, both -> EXPIRED/REVOKED. EXPIRED and REVOKED are terminal in CLOUD-01B -
 * renewal/reactivation of an expired license is out of scope.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<LicenseStatus, readonly LicenseStatus[]>> = {
  [LicenseStatus.ACTIVE]: [LicenseStatus.SUSPENDED, LicenseStatus.EXPIRED, LicenseStatus.REVOKED],
  [LicenseStatus.SUSPENDED]: [LicenseStatus.ACTIVE, LicenseStatus.EXPIRED, LicenseStatus.REVOKED],
  [LicenseStatus.EXPIRED]: [],
  [LicenseStatus.REVOKED]: [],
};

export function isLicenseStatusTransitionAllowed(from: LicenseStatus, to: LicenseStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
