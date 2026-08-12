import { EntitlementCode } from "../../domain/entitlement-code";
import { License } from "../../domain/license";
import type { LicenseEdition } from "../../domain/license-edition";
import { LicenseEntitlement } from "../../domain/license-entitlement";
import { LicenseId } from "../../domain/license-id";
import type { LicenseModel } from "../../domain/license-model";
import { LicenseNumber } from "../../domain/license-number";
import type { LicenseStatus } from "../../domain/license-status";
import { LicenseEntitlementRecord, LicenseRecord } from "./license.record";

export class LicenseEntitlementMapper {
  static toDomain(record: LicenseEntitlementRecord): LicenseEntitlement {
    return LicenseEntitlement.reconstitute({
      id: record.id,
      licenseId: record.licenseId,
      code: EntitlementCode.reconstitute(record.code),
      enabled: record.enabled,
      configuration: record.configuration,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toRecord(entitlement: LicenseEntitlement): LicenseEntitlementRecord {
    const record = new LicenseEntitlementRecord();
    record.id = entitlement.id;
    record.licenseId = entitlement.licenseId;
    record.code = entitlement.code.toString();
    record.enabled = entitlement.enabled;
    record.configuration = entitlement.configuration;
    record.createdAt = entitlement.createdAt;
    record.updatedAt = entitlement.updatedAt;
    return record;
  }
}

export class LicenseMapper {
  /** `entitlementRecords` may be omitted for list views, which intentionally skip loading them. */
  static toDomain(
    record: LicenseRecord,
    entitlementRecords: readonly LicenseEntitlementRecord[] = [],
  ): License {
    return License.reconstitute({
      id: LicenseId.of(record.id),
      customerId: record.customerId,
      licenseNumber: LicenseNumber.reconstitute(record.licenseNumber),
      edition: record.edition as LicenseEdition,
      licenseModel: record.licenseModel as LicenseModel,
      status: record.status as LicenseStatus,
      validFrom: record.validFrom,
      validUntil: record.validUntil,
      maxInstallations: record.maxInstallations,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      entitlements: entitlementRecords.map(LicenseEntitlementMapper.toDomain),
    });
  }

  static toRecord(license: License): LicenseRecord {
    const record = new LicenseRecord();
    record.id = license.id.toString();
    record.customerId = license.customerId;
    record.licenseNumber = license.licenseNumber.toString();
    record.edition = license.edition;
    record.licenseModel = license.licenseModel;
    record.status = license.status;
    record.validFrom = license.validFrom;
    record.validUntil = license.validUntil;
    record.maxInstallations = license.maxInstallations;
    record.createdAt = license.createdAt;
    record.updatedAt = license.updatedAt;
    return record;
  }
}
