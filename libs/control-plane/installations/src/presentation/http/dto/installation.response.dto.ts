import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { Installation } from "../../../domain/installation";
import { InstallationStatus } from "../../../domain/installation-status";
import { Platform } from "../../../domain/platform";

export class InstallationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() licenseId!: string;
  @ApiProperty() installationCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Platform }) platform!: Platform;
  @ApiProperty({ enum: InstallationStatus }) status!: InstallationStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) registeredAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromDomain(installation: Installation): InstallationResponseDto {
    const dto = new InstallationResponseDto();
    dto.id = installation.id.toString();
    dto.customerId = installation.customerId;
    dto.licenseId = installation.licenseId;
    dto.installationCode = installation.installationCode.toString();
    dto.name = installation.name;
    dto.platform = installation.platform;
    dto.status = installation.status;
    dto.registeredAt = installation.registeredAt?.toISOString() ?? null;
    dto.createdAt = installation.createdAt.toISOString();
    dto.updatedAt = installation.updatedAt.toISOString();
    return dto;
  }
}
