import { ApiProperty } from "@nestjs/swagger";
import { LicenseResponseDto } from "./license.response.dto";

export class LicenseListResponseDto {
  @ApiProperty({
    type: [LicenseResponseDto],
    description: "entitlements are omitted on list items",
  })
  items!: LicenseResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
