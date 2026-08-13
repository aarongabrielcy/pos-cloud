import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  ApiErrorResponse,
  CurrentAdmin,
  type CurrentAdminPrincipal,
  PERMISSIONS,
  RequirePermissions,
} from "@pos-cloud/access-management";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import type { Request } from "express";
import { ChangeLicenseStatusUseCase } from "../../application/use-cases/change-license-status.use-case";
import { CreateLicenseUseCase } from "../../application/use-cases/create-license.use-case";
import { GetLicenseByIdUseCase } from "../../application/use-cases/get-license-by-id.use-case";
import { ListLicensesUseCase } from "../../application/use-cases/list-licenses.use-case";
import { ReplaceLicenseEntitlementsUseCase } from "../../application/use-cases/replace-license-entitlements.use-case";
import { LicenseNotFoundError } from "../../domain/license.errors";
import { ChangeLicenseStatusRequestDto } from "./dto/change-license-status.request.dto";
import { CreateLicenseRequestDto } from "./dto/create-license.request.dto";
import { LicenseListResponseDto } from "./dto/license-list.response.dto";
import { LicenseResponseDto } from "./dto/license.response.dto";
import { ListLicensesQueryDto } from "./dto/list-licenses.query.dto";
import { ReplaceLicenseEntitlementsRequestDto } from "./dto/replace-license-entitlements.request.dto";

/** Same inline pattern AllExceptionsFilter already uses for reading the correlation id off the request. */
function buildAdminAuditActor(
  admin: CurrentAdminPrincipal,
  request: Request & { id?: string | number },
): AuditActorContext {
  return {
    actorType: "ADMIN",
    actorId: admin.adminUserId,
    correlationId: request.id !== undefined ? String(request.id) : "unknown",
  };
}

@ApiTags("licenses")
@ApiBearerAuth("admin-bearer")
@ApiErrorResponse()
@Controller("api/v1/control-plane/licenses")
export class LicenseController {
  constructor(
    private readonly createLicenseUseCase: CreateLicenseUseCase,
    private readonly getLicenseByIdUseCase: GetLicenseByIdUseCase,
    private readonly listLicensesUseCase: ListLicensesUseCase,
    private readonly changeLicenseStatusUseCase: ChangeLicenseStatusUseCase,
    private readonly replaceLicenseEntitlementsUseCase: ReplaceLicenseEntitlementsUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LICENSES.CREATE)
  @ApiCreatedResponse({ type: LicenseResponseDto })
  @ApiOperation({ summary: "Create a license" })
  async create(
    @Body() body: CreateLicenseRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<LicenseResponseDto> {
    const license = await this.createLicenseUseCase.execute(
      {
        customerId: body.customerId,
        licenseNumber: body.licenseNumber,
        edition: body.edition,
        licenseModel: body.licenseModel,
        validFrom: new Date(body.validFrom),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        maxInstallations: body.maxInstallations,
        entitlements: body.entitlements,
      },
      buildAdminAuditActor(admin, request),
    );
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.LICENSES.READ)
  @ApiOkResponse({ type: LicenseResponseDto })
  @ApiOperation({ summary: "Get a license by id, including its entitlements" })
  async getById(@Param("id", ParseUUIDPipe) id: string): Promise<LicenseResponseDto> {
    const license = await this.getLicenseByIdUseCase.execute(id);
    if (!license) {
      throw new LicenseNotFoundError(id);
    }
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LICENSES.READ)
  @ApiOkResponse({ type: LicenseListResponseDto })
  @ApiOperation({ summary: "List licenses (entitlements omitted per item)" })
  async list(@Query() query: ListLicensesQueryDto): Promise<LicenseListResponseDto> {
    const result = await this.listLicensesUseCase.execute(query);
    return {
      items: result.items.map((license) =>
        LicenseResponseDto.fromDomain(license, { includeEntitlements: false }),
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.LICENSES.STATUS_CHANGE)
  @ApiOkResponse({ type: LicenseResponseDto })
  @ApiOperation({ summary: "Change a license's status" })
  async changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ChangeLicenseStatusRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<LicenseResponseDto> {
    const license = await this.changeLicenseStatusUseCase.execute(
      { id, status: body.status },
      buildAdminAuditActor(admin, request),
    );
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }

  @Put(":id/entitlements")
  @RequirePermissions(PERMISSIONS.LICENSES.ENTITLEMENTS_MANAGE)
  @ApiOkResponse({ type: LicenseResponseDto })
  @ApiOperation({ summary: "Replace the full entitlement collection for a license" })
  async replaceEntitlements(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReplaceLicenseEntitlementsRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<LicenseResponseDto> {
    const license = await this.replaceLicenseEntitlementsUseCase.execute(
      { licenseId: id, entitlements: body.entitlements },
      buildAdminAuditActor(admin, request),
    );
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }
}
