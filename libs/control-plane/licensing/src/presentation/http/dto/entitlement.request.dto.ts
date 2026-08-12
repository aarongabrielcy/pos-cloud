import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional, IsString, Length } from "class-validator";

export class EntitlementRequestDto {
  @ApiProperty({ example: "integrated_payments" })
  @IsString()
  @Length(1, 100)
  code!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ type: Object, nullable: true, example: null })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown> | null;
}
