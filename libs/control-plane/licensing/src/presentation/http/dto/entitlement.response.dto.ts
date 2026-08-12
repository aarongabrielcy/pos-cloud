import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { LicenseEntitlement } from "../../../domain/license-entitlement";

export class EntitlementResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() enabled!: boolean;
  @ApiPropertyOptional({ type: Object, nullable: true }) configuration!: Record<
    string,
    unknown
  > | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromDomain(entitlement: LicenseEntitlement): EntitlementResponseDto {
    const dto = new EntitlementResponseDto();
    dto.id = entitlement.id;
    dto.code = entitlement.code.toString();
    dto.enabled = entitlement.enabled;
    dto.configuration = entitlement.configuration;
    dto.createdAt = entitlement.createdAt.toISOString();
    dto.updatedAt = entitlement.updatedAt.toISOString();
    return dto;
  }
}
