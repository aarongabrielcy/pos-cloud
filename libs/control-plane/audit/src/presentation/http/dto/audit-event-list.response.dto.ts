import { ApiProperty } from "@nestjs/swagger";
import { AuditEventResponseDto } from "./audit-event.response.dto";

export class AuditEventListResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto] }) items!: AuditEventResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
