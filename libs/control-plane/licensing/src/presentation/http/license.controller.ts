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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS, RequirePermissions } from "@pos-cloud/access-management";
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

@ApiTags("licenses")
@ApiBearerAuth("admin-bearer")
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
  @ApiOperation({ summary: "Create a license" })
  async create(@Body() body: CreateLicenseRequestDto): Promise<LicenseResponseDto> {
    const license = await this.createLicenseUseCase.execute({
      customerId: body.customerId,
      licenseNumber: body.licenseNumber,
      edition: body.edition,
      licenseModel: body.licenseModel,
      validFrom: new Date(body.validFrom),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      maxInstallations: body.maxInstallations,
      entitlements: body.entitlements,
    });
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.LICENSES.READ)
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
  @ApiOperation({ summary: "Change a license's status" })
  async changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ChangeLicenseStatusRequestDto,
  ): Promise<LicenseResponseDto> {
    const license = await this.changeLicenseStatusUseCase.execute({ id, status: body.status });
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }

  @Put(":id/entitlements")
  @RequirePermissions(PERMISSIONS.LICENSES.ENTITLEMENTS_MANAGE)
  @ApiOperation({ summary: "Replace the full entitlement collection for a license" })
  async replaceEntitlements(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReplaceLicenseEntitlementsRequestDto,
  ): Promise<LicenseResponseDto> {
    const license = await this.replaceLicenseEntitlementsUseCase.execute({
      licenseId: id,
      entitlements: body.entitlements,
    });
    return LicenseResponseDto.fromDomain(license, { includeEntitlements: true });
  }
}
