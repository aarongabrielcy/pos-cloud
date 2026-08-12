import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { CustomerStatus } from "../../../domain/customer-status";

export class ChangeCustomerStatusRequestDto {
  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.SUSPENDED })
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}
