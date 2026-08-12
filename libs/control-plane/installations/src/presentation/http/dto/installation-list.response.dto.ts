import { ApiProperty } from "@nestjs/swagger";
import { InstallationResponseDto } from "./installation.response.dto";

export class InstallationListResponseDto {
  @ApiProperty({ type: [InstallationResponseDto] }) items!: InstallationResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
