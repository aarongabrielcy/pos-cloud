import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CustomerDisplaySummary } from "../../../application/ports/customer-summary-reader.port";

/**
 * Human-facing Customer identity attached to License responses (customerId remains present too,
 * unchanged, for backward compatibility/machine use) - enough to render "CODE — LEGAL NAME" without
 * a separate GET /customers/:id round trip. Licensing's own copy, structurally identical to
 * Installations' - see CustomerReaderAdapter's precedent comment for why each bounded context owns
 * its own copy rather than sharing a cross-package DTO.
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
