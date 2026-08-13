import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsOptional, IsString, Length } from "class-validator";

export class RecordHeartbeatRequestDto {
  @ApiProperty({ example: "1.4.2", description: "POS Desktop app version reporting in." })
  @IsString()
  @Length(1, 50)
  appVersion!: string;

  @ApiPropertyOptional({
    description:
      "Diagnostic only (client clock drift detection) - never authoritative for lastSeenAt/health, " +
      "which are always derived from server-received time.",
  })
  @IsOptional()
  @IsISO8601()
  clientReportedAt?: string;
}
