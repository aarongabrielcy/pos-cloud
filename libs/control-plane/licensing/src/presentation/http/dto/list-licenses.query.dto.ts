import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { LicenseEdition } from "../../../domain/license-edition";
import { LicenseStatus } from "../../../domain/license-status";

export class ListLicensesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: LicenseStatus })
  @IsOptional()
  @IsEnum(LicenseStatus)
  status?: LicenseStatus;

  @ApiPropertyOptional({ enum: LicenseEdition })
  @IsOptional()
  @IsEnum(LicenseEdition)
  edition?: LicenseEdition;

  @ApiPropertyOptional({ description: "Matched against licenseNumber" })
  @IsOptional()
  @IsString()
  search?: string;
}
