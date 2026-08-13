import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AuditEvent } from "../../../domain/audit-event";

export class AuditEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ enum: ["ADMIN", "INSTALLATION", "SYSTEM"] }) actorType!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) actorId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty() resourceId!: string;
  @ApiProperty() correlationId!: string;
  @ApiProperty({ type: Object }) metadata!: Record<string, unknown>;

  static fromDomain(event: AuditEvent): AuditEventResponseDto {
    const dto = new AuditEventResponseDto();
    dto.id = event.id;
    dto.occurredAt = event.occurredAt.toISOString();
    dto.actorType = event.actorType;
    dto.actorId = event.actorId;
    dto.action = event.action;
    dto.resourceType = event.resourceType;
    dto.resourceId = event.resourceId;
    dto.correlationId = event.correlationId;
    dto.metadata = event.metadata as Record<string, unknown>;
    return dto;
  }
}
