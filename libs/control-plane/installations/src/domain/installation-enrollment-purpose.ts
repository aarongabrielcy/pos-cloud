export enum InstallationEnrollmentPurpose {
  /** First-ever enrollment for a PENDING Installation - the only purpose that calls `Installation.activate()`. */
  INITIAL = "INITIAL",
  /** Admin-triggered manual credential recovery/rekey for an ACTIVE or SUSPENDED Installation - never changes status. */
  RECOVERY = "RECOVERY",
}
