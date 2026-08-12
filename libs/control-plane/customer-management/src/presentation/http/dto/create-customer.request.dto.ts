import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Length } from "class-validator";

export class CreateCustomerRequestDto {
  @ApiProperty({
    example: "GST-MX",
    description: "Normalized (trim+uppercase) to 3-50 chars, ^[A-Z0-9][A-Z0-9_-]{2,49}$",
  })
  @IsString()
  @Length(1, 50)
  code!: string;

  @ApiProperty({ example: "GS Trackme S.A. de C.V." })
  @IsString()
  @Length(2, 200)
  legalName!: string;

  @ApiPropertyOptional({ example: "GS Trackme" })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  tradeName?: string;
}
