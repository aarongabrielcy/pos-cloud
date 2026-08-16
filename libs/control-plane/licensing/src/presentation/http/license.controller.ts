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
import { GetCustomerSummariesUseCase } from "../../application/use-cases/get-customer-summaries.use-case";
import { GetLicenseByIdUseCase } from "../../application/use-cases/get-license-by-id.use-case";
import { ListLicensesUseCase } from "../../application/use-cases/list-licenses.use-case";
import { ReplaceLicenseEntitlementsUseCase } from "../../application/use-cases/replace-license-entitlements.use-case";
import type { License } from "../../domain/license";
import { LicenseNotFoundError } from "../../domain/license.errors";
import type { CustomerDisplaySummary } from "../../application/ports/customer-summary-reader.port";
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
    private readonly getCustomerSummariesUseCase: GetCustomerSummariesUseCase,
  ) {}

  /**
   * Batches a single GetCustomerSummariesUseCase call for however many distinct customerIds are
   * involved (1 for create/getById/changeStatus/replaceEntitlements, deduplicated-across-the-page
   * for list) - never one call per License. A summary missing from the result for an id a License
   * genuinely references would mean the domain's own referential guarantee (a License can only be
   * created against an existing Customer, and Customers are never deleted) has been violated -
   * that's a real internal-consistency bug, not a normal "not found" outcome, so it's a plain Error
   * (mapped to a generic 500 by AllExceptionsFilter) rather than a new domain error code.
   */
  private async getCustomerSummaries(
    licenses: readonly License[],
  ): Promise<Map<string, CustomerDisplaySummary>> {
    const ids = [...new Set(licenses.map((license) => license.customerId))];
    return this.getCustomerSummariesUseCase.execute(ids);
  }

  private requireCustomerSummary(
    summaries: Map<string, CustomerDisplaySummary>,
    customerId: string,
  ): CustomerDisplaySummary {
    const summary = summaries.get(customerId);
    if (!summary) {
      throw new Error(
        `Customer summary missing for customerId ${customerId} - data inconsistency.`,
      );
    }
    return summary;
  }

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
    const summaries = await this.getCustomerSummaries([license]);
    return LicenseResponseDto.fromDomain(
      license,
      this.requireCustomerSummary(summaries, license.customerId),
      { includeEntitlements: true },
    );
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
    const summaries = await this.getCustomerSummaries([license]);
    return LicenseResponseDto.fromDomain(
      license,
      this.requireCustomerSummary(summaries, license.customerId),
      { includeEntitlements: true },
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LICENSES.READ)
  @ApiOkResponse({ type: LicenseListResponseDto })
  @ApiOperation({ summary: "List licenses (entitlements omitted per item)" })
  async list(@Query() query: ListLicensesQueryDto): Promise<LicenseListResponseDto> {
    const result = await this.listLicensesUseCase.execute(query);
    const summaries = await this.getCustomerSummaries(result.items);
    return {
      items: result.items.map((license) =>
        LicenseResponseDto.fromDomain(
          license,
          this.requireCustomerSummary(summaries, license.customerId),
          { includeEntitlements: false },
        ),
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
    const summaries = await this.getCustomerSummaries([license]);
    return LicenseResponseDto.fromDomain(
      license,
      this.requireCustomerSummary(summaries, license.customerId),
      { includeEntitlements: true },
    );
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
    const summaries = await this.getCustomerSummaries([license]);
    return LicenseResponseDto.fromDomain(
      license,
      this.requireCustomerSummary(summaries, license.customerId),
      { includeEntitlements: true },
    );
  }
}
