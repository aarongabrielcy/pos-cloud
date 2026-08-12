import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { LicenseEdition } from "../../../domain/license-edition";
import { LicenseModel } from "../../../domain/license-model";
import { EntitlementRequestDto } from "./entitlement.request.dto";

export class CreateLicenseRequestDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  customerId!: string;

  @ApiProperty({
    example: "LIC-GST-00001",
    description: "3-80 chars, normalized to ^[A-Z0-9][A-Z0-9_-]{4,79}$",
  })
  @IsString()
  @Length(1, 80)
  licenseNumber!: string;

  @ApiProperty({ enum: LicenseEdition })
  @IsEnum(LicenseEdition)
  edition!: LicenseEdition;

  @ApiProperty({ enum: LicenseModel })
  @IsEnum(LicenseModel)
  licenseModel!: LicenseModel;

  @ApiProperty({ example: "2026-08-09T00:00:00.000Z" })
  @IsISO8601()
  validFrom!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true, example: null })
  @IsOptional()
  @IsISO8601()
  validUntil?: string | null;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  maxInstallations!: number;

  @ApiPropertyOptional({ type: [EntitlementRequestDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EntitlementRequestDto)
  entitlements?: EntitlementRequestDto[];
}
