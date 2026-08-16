import { ApiProperty } from "@nestjs/swagger";
import type { LicenseDisplaySummary } from "../../../application/ports/license-summary-reader.port";

/**
 * Human-facing License identity attached to Installation responses (licenseId remains present
 * too, unchanged, for backward compatibility/machine use) - enough to render the license number
 * without a separate GET /licenses/:id round trip.
 */
export class LicenseSummaryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() licenseNumber!: string;
  @ApiProperty() edition!: string;
  @ApiProperty() status!: string;

  static fromSummary(summary: LicenseDisplaySummary): LicenseSummaryResponseDto {
    const dto = new LicenseSummaryResponseDto();
    dto.id = summary.id;
    dto.licenseNumber = summary.licenseNumber;
    dto.edition = summary.edition;
    dto.status = summary.status;
    return dto;
  }
}
