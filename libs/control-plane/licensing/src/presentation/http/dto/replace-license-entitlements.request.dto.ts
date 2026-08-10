import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, ValidateNested } from "class-validator";
import { EntitlementRequestDto } from "./entitlement.request.dto";

export class ReplaceLicenseEntitlementsRequestDto {
  @ApiProperty({
    type: [EntitlementRequestDto],
    description: "Full desired entitlement state - replaces the existing collection.",
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EntitlementRequestDto)
  entitlements!: EntitlementRequestDto[];
}
