import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CustomerDisplaySummary } from "../../../application/ports/customer-summary-reader.port";

/**
 * Human-facing Customer identity attached to Installation responses (customerId remains present
 * too, unchanged, for backward compatibility/machine use). Installations' own copy, structurally
 * identical to Licensing's - see CustomerReaderAdapter's precedent comment for why each bounded
 * context owns its own copy rather than sharing a cross-package DTO.
 */
export class CustomerSummaryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() legalName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) tradeName!: string | null;

  static fromSummary(summary: CustomerDisplaySummary): CustomerSummaryResponseDto {
    const dto = new CustomerSummaryResponseDto();
    dto.id = summary.id;
    dto.code = summary.code;
    dto.legalName = summary.legalName;
    dto.tradeName = summary.tradeName;
    return dto;
  }
}
