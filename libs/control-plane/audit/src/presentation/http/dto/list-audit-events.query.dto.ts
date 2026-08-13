import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from "class-validator";
import type { AuditActorType } from "@pos-cloud/shared-kernel";

const ACTOR_TYPES: readonly AuditActorType[] = ["ADMIN", "INSTALLATION", "SYSTEM"];

export class ListAuditEventsQueryDto {
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

  @ApiPropertyOptional({ enum: ACTOR_TYPES })
  @IsOptional()
  @IsIn(ACTOR_TYPES)
  actorType?: AuditActorType;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) actorId?: string;

  @ApiPropertyOptional({ example: "installation.status.changed" })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  action?: string;

  @ApiPropertyOptional({ example: "Installation" })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  resourceType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) resourceId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 128) correlationId?: string;

  @ApiPropertyOptional({ description: "ISO 8601 - inclusive lower bound on occurredAt" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: "ISO 8601 - inclusive upper bound on occurredAt" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
