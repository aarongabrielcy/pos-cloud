import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { InstallationStatus } from "../../../domain/installation-status";

export class ChangeInstallationStatusRequestDto {
  @ApiProperty({
    enum: InstallationStatus,
    example: InstallationStatus.SUSPENDED,
    description: "PENDING -> ACTIVE is not available through this endpoint (see docs).",
  })
  @IsEnum(InstallationStatus)
  status!: InstallationStatus;
}
