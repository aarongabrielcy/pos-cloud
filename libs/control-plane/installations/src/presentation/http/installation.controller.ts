import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS, RequirePermissions } from "@pos-cloud/access-management";
import { ChangeInstallationStatusUseCase } from "../../application/use-cases/change-installation-status.use-case";
import { CreateInstallationUseCase } from "../../application/use-cases/create-installation.use-case";
import { GetInstallationByIdUseCase } from "../../application/use-cases/get-installation-by-id.use-case";
import { ListInstallationsUseCase } from "../../application/use-cases/list-installations.use-case";
import { InstallationNotFoundError } from "../../domain/installation.errors";
import { ChangeInstallationStatusRequestDto } from "./dto/change-installation-status.request.dto";
import { CreateInstallationRequestDto } from "./dto/create-installation.request.dto";
import { InstallationListResponseDto } from "./dto/installation-list.response.dto";
import { InstallationResponseDto } from "./dto/installation.response.dto";
import { ListInstallationsQueryDto } from "./dto/list-installations.query.dto";

@ApiTags("installations")
@ApiBearerAuth("admin-bearer")
@Controller("api/v1/control-plane/installations")
export class InstallationController {
  constructor(
    private readonly createInstallationUseCase: CreateInstallationUseCase,
    private readonly getInstallationByIdUseCase: GetInstallationByIdUseCase,
    private readonly listInstallationsUseCase: ListInstallationsUseCase,
    private readonly changeInstallationStatusUseCase: ChangeInstallationStatusUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.CREATE)
  @ApiOperation({ summary: "Create an installation (starts PENDING)" })
  async create(@Body() body: CreateInstallationRequestDto): Promise<InstallationResponseDto> {
    const installation = await this.createInstallationUseCase.execute(body);
    return InstallationResponseDto.fromDomain(installation);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.READ)
  @ApiOperation({ summary: "Get an installation by id" })
  async getById(@Param("id", ParseUUIDPipe) id: string): Promise<InstallationResponseDto> {
    const installation = await this.getInstallationByIdUseCase.execute(id);
    if (!installation) {
      throw new InstallationNotFoundError(id);
    }
    return InstallationResponseDto.fromDomain(installation);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.READ)
  @ApiOperation({ summary: "List installations" })
  async list(@Query() query: ListInstallationsQueryDto): Promise<InstallationListResponseDto> {
    const result = await this.listInstallationsUseCase.execute(query);
    return {
      items: result.items.map(InstallationResponseDto.fromDomain),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.STATUS_CHANGE)
  @ApiOperation({
    summary: "Administrative status change",
    description: "PENDING -> ACTIVE is not available here; activation is a future CLOUD-01C flow.",
  })
  async changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ChangeInstallationStatusRequestDto,
  ): Promise<InstallationResponseDto> {
    const installation = await this.changeInstallationStatusUseCase.execute({
      id,
      status: body.status,
    });
    return InstallationResponseDto.fromDomain(installation);
  }
}
