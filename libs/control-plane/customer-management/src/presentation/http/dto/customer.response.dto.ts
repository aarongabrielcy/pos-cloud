import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { Customer } from "../../../domain/customer";
import { CustomerStatus } from "../../../domain/customer-status";

export class CustomerResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() legalName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) tradeName!: string | null;
  @ApiProperty({ enum: CustomerStatus }) status!: CustomerStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromDomain(customer: Customer): CustomerResponseDto {
    const dto = new CustomerResponseDto();
    dto.id = customer.id.toString();
    dto.code = customer.code.toString();
    dto.legalName = customer.legalName.toString();
    dto.tradeName = customer.tradeName?.toString() ?? null;
    dto.status = customer.status;
    dto.createdAt = customer.createdAt.toISOString();
    dto.updatedAt = customer.updatedAt.toISOString();
    return dto;
  }
}
