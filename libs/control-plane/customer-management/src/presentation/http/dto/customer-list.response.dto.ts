import { ApiProperty } from "@nestjs/swagger";
import { CustomerResponseDto } from "./customer.response.dto";

export class CustomerListResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] }) items!: CustomerResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
