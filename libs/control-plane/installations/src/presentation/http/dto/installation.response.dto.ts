import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { Installation } from "../../../domain/installation";
import { InstallationStatus } from "../../../domain/installation-status";
import { Platform } from "../../../domain/platform";
import type { CustomerDisplaySummary } from "../../../application/ports/customer-summary-reader.port";
import type { LicenseDisplaySummary } from "../../../application/ports/license-summary-reader.port";
import { CustomerSummaryResponseDto } from "./customer-summary.response.dto";
import { LicenseSummaryResponseDto } from "./license-summary.response.dto";

export class InstallationResponseDto {
  @ApiProperty() id!: string;
  /** Machine identifier - kept for backward compatibility/machine use. See `customer` for the
   *  human-facing summary. */
  @ApiProperty() customerId!: string;
  @ApiProperty({ type: CustomerSummaryResponseDto }) customer!: CustomerSummaryResponseDto;
  /** Machine identifier - kept for backward compatibility/machine use. See `license` for the
   *  human-facing summary. */
  @ApiProperty() licenseId!: string;
  @ApiProperty({ type: LicenseSummaryResponseDto }) license!: LicenseSummaryResponseDto;
  @ApiProperty() installationCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Platform }) platform!: Platform;
  @ApiProperty({ enum: InstallationStatus }) status!: InstallationStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) registeredAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromDomain(
    installation: Installation,
    customer: CustomerDisplaySummary,
    license: LicenseDisplaySummary,
  ): InstallationResponseDto {
    const dto = new InstallationResponseDto();
    dto.id = installation.id.toString();
    dto.customerId = installation.customerId;
    dto.customer = CustomerSummaryResponseDto.fromSummary(customer);
    dto.licenseId = installation.licenseId;
    dto.license = LicenseSummaryResponseDto.fromSummary(license);
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
