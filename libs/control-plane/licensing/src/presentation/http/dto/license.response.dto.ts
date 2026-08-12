import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { License } from "../../../domain/license";
import { LicenseEdition } from "../../../domain/license-edition";
import { LicenseModel } from "../../../domain/license-model";
import { LicenseStatus } from "../../../domain/license-status";
import { EntitlementResponseDto } from "./entitlement.response.dto";

export class LicenseResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() licenseNumber!: string;
  @ApiProperty({ enum: LicenseEdition }) edition!: LicenseEdition;
  @ApiProperty({ enum: LicenseModel }) licenseModel!: LicenseModel;
  @ApiProperty({ enum: LicenseStatus }) status!: LicenseStatus;
  @ApiProperty() validFrom!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) validUntil!: string | null;
  @ApiProperty() maxInstallations!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  /** Present on the detail view (GET by id); omitted from list items - see docs. */
  @ApiPropertyOptional({ type: [EntitlementResponseDto] }) entitlements?: EntitlementResponseDto[];

  static fromDomain(
    license: License,
    options: { includeEntitlements: boolean },
  ): LicenseResponseDto {
    const dto = new LicenseResponseDto();
    dto.id = license.id.toString();
    dto.customerId = license.customerId;
    dto.licenseNumber = license.licenseNumber.toString();
    dto.edition = license.edition;
    dto.licenseModel = license.licenseModel;
    dto.status = license.status;
    dto.validFrom = license.validFrom.toISOString();
    dto.validUntil = license.validUntil?.toISOString() ?? null;
    dto.maxInstallations = license.maxInstallations;
    dto.createdAt = license.createdAt.toISOString();
    dto.updatedAt = license.updatedAt.toISOString();
    if (options.includeEntitlements) {
      dto.entitlements = license.entitlements.map(EntitlementResponseDto.fromDomain);
    }
    return dto;
  }
}
