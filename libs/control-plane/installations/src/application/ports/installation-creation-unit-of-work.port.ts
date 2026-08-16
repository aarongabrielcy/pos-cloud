import type { Installation } from "../../domain/installation";
import type { InstallationCode } from "../../domain/installation-code";

/**
 * Real atomicity for the capacity-check-then-insert sequence in CreateInstallationUseCase (backend
 * backlog: "maxInstallations concurrent-create race"). A PostgreSQL advisory lock keyed on
 * licenseId (transaction-scoped via `pg_advisory_xact_lock`, released automatically on
 * commit/rollback) serializes concurrent creates for the SAME license across processes/replicas -
 * two admins (or two racing requests) creating an Installation against the same License at the
 * same time now queue instead of both reading a stale capacity count.
 *
 * Deliberately does NOT touch the `licenses` table at all - Installations already knows
 * license.maxInstallations via its own existing LicenseReaderPort, read *before* this unit of work
 * even starts (maxInstallations is immutable after License creation: no update endpoint touches it
 * - see CreateLicenseRequestDto/ChangeLicenseStatusRequestDto, the only two License mutations that
 * exist). So there is nothing to re-read from Licensing inside the lock, no cross-context join, and
 * no need to lock a License row through Licensing's own API - the lock key is just a value, not a
 * foreign reference (see this port's docs/architecture note for the ownership reasoning, WEB-01E/
 * CLOUD-01D-hardening brief §17).
 *
 * Lock scope covers the exact same three steps CreateInstallationUseCase already performed
 * sequentially and non-atomically: capacity check, installationCode-uniqueness check, save. Their
 * relative order and error types are unchanged - only WHERE (inside one serialized transaction) they
 * run has changed.
 */
export interface InstallationCreationContext {
  /** Counts installations for a license whose status is NOT DECOMMISSIONED - same semantics as
   *  InstallationRepository.countNonDecommissionedByLicense, evaluated inside the lock. */
  countNonDecommissionedByLicense(licenseId: string): Promise<number>;
  findInstallationByCode(code: InstallationCode): Promise<Installation | null>;
  /** Throws InstallationCodeAlreadyExistsError on a unique-constraint violation - same behavior as
   *  InstallationRepository.save. */
  saveInstallation(installation: Installation): Promise<void>;
}

export interface InstallationCreationUnitOfWork {
  runExclusiveForLicense<T>(
    licenseId: string,
    fn: (ctx: InstallationCreationContext) => Promise<T>,
  ): Promise<T>;
}

export const INSTALLATION_CREATION_UNIT_OF_WORK = Symbol("INSTALLATION_CREATION_UNIT_OF_WORK");
