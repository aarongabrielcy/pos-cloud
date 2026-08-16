import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, IsUUID, Length } from "class-validator";
import { Platform } from "../../../domain/platform";

export class CreateInstallationRequestDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  licenseId!: string;

  @ApiProperty({
    example: "POS-GST-00001",
    description: "5-80 chars, normalized to ^[A-Z0-9][A-Z0-9_-]{4,79}$",
  })
  @IsString()
  @Length(1, 80)
  installationCode!: string;

  @ApiProperty({ example: "Sucursal Principal" })
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform!: Platform;
}
