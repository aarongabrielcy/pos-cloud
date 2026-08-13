import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { InstallationHealthDetail } from "../../../application/use-cases/get-installation-health.use-case";
import { InstallationHealthStatus } from "../../../domain/installation-health-status";
import { InstallationStatus } from "../../../domain/installation-status";

export class InstallationHealthResponseDto {
  @ApiProperty() installationId!: string;
  @ApiProperty({ enum: InstallationStatus }) lifecycleStatus!: InstallationStatus;
  @ApiProperty({ enum: InstallationHealthStatus }) healthStatus!: InstallationHealthStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) lastSeenAt!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) firstSeenAt!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) appVersion!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) clientReportedAt!: string | null;

  static fromDetail(detail: InstallationHealthDetail): InstallationHealthResponseDto {
    const dto = new InstallationHealthResponseDto();
    dto.installationId = detail.installationId;
    dto.lifecycleStatus = detail.lifecycleStatus;
    dto.healthStatus = detail.healthStatus;
    dto.lastSeenAt = detail.lastSeenAt?.toISOString() ?? null;
    dto.firstSeenAt = detail.firstSeenAt?.toISOString() ?? null;
    dto.appVersion = detail.appVersion;
    dto.clientReportedAt = detail.clientReportedAt?.toISOString() ?? null;
    return dto;
  }
}
