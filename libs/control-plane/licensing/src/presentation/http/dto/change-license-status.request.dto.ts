import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { LicenseStatus } from "../../../domain/license-status";

export class ChangeLicenseStatusRequestDto {
  @ApiProperty({ enum: LicenseStatus, example: LicenseStatus.SUSPENDED })
  @IsEnum(LicenseStatus)
  status!: LicenseStatus;
}
