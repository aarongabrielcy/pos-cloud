import { ApiProperty } from "@nestjs/swagger";
import { InstallationListItemResponseDto } from "./installation-list-item.response.dto";

export class InstallationListResponseDto {
  @ApiProperty({ type: [InstallationListItemResponseDto] })
  items!: InstallationListItemResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
