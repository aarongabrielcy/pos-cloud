import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InstallationHealthStatus } from "../../../domain/installation-health-status";
import type { InstallationListItemWithHealth } from "../../../application/use-cases/list-installations.use-case";
import type { CustomerDisplaySummary } from "../../../application/ports/customer-summary-reader.port";
import type { LicenseDisplaySummary } from "../../../application/ports/license-summary-reader.port";
import { InstallationResponseDto } from "./installation.response.dto";

/**
 * Extends InstallationResponseDto with healthStatus/lastSeenAt for the list endpoint only - the
 * single-item GET response stays InstallationResponseDto, unchanged. Lifecycle
 * (InstallationResponseDto.status) and health are always two separate fields, never merged - see
 * docs/architecture/installation-health.md#lifecycle-vs-health.
 */
export class InstallationListItemResponseDto extends InstallationResponseDto {
  @ApiProperty({ enum: InstallationHealthStatus }) healthStatus!: InstallationHealthStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) lastSeenAt!: string | null;

  static fromListItem(
    item: InstallationListItemWithHealth,
    customer: CustomerDisplaySummary,
    license: LicenseDisplaySummary,
  ): InstallationListItemResponseDto {
    const dto = new InstallationListItemResponseDto();
    Object.assign(dto, InstallationResponseDto.fromDomain(item.installation, customer, license));
    dto.healthStatus = item.healthStatus;
    dto.lastSeenAt = item.lastSeenAt?.toISOString() ?? null;
    return dto;
  }
}
