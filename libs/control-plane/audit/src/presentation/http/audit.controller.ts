import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS, RequirePermissions } from "@pos-cloud/access-management";
import { ListAuditEventsUseCase } from "../../application/use-cases/list-audit-events.use-case";
import { AuditEventListResponseDto } from "./dto/audit-event-list.response.dto";
import { AuditEventResponseDto } from "./dto/audit-event.response.dto";
import { ListAuditEventsQueryDto } from "./dto/list-audit-events.query.dto";

/**
 * Admin-only, read-only. No POST/PATCH/DELETE anywhere in this controller - audit events are
 * append-only from the API's perspective (see docs/architecture/audit.md#immutability).
 */
@ApiTags("audit")
@ApiBearerAuth("admin-bearer")
@Controller("api/v1/control-plane/audit-events")
export class AuditController {
  constructor(private readonly listAuditEventsUseCase: ListAuditEventsUseCase) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT.READ)
  @ApiOperation({ summary: "List audit events (paginated, filterable)" })
  async list(@Query() query: ListAuditEventsQueryDto): Promise<AuditEventListResponseDto> {
    const result = await this.listAuditEventsUseCase.execute({
      page: query.page,
      pageSize: query.pageSize,
      actorType: query.actorType,
      actorId: query.actorId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      correlationId: query.correlationId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return {
      items: result.items.map(AuditEventResponseDto.fromDomain),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}
