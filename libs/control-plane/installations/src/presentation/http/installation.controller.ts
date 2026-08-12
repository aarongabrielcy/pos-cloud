import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS, RequirePermissions } from "@pos-cloud/access-management";
import { ChangeInstallationStatusUseCase } from "../../application/use-cases/change-installation-status.use-case";
import { CreateInstallationUseCase } from "../../application/use-cases/create-installation.use-case";
import { GetInstallationByIdUseCase } from "../../application/use-cases/get-installation-by-id.use-case";
import { IssueInstallationEnrollmentUseCase } from "../../application/use-cases/issue-installation-enrollment.use-case";
import { ListInstallationsUseCase } from "../../application/use-cases/list-installations.use-case";
import { RevokeInstallationCredentialUseCase } from "../../application/use-cases/revoke-installation-credential.use-case";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationNotFoundError } from "../../domain/installation.errors";
import { ChangeInstallationStatusRequestDto } from "./dto/change-installation-status.request.dto";
import { CreateInstallationRequestDto } from "./dto/create-installation.request.dto";
import { InstallationListResponseDto } from "./dto/installation-list.response.dto";
import { InstallationResponseDto } from "./dto/installation.response.dto";
import { IssueInstallationEnrollmentResponseDto } from "./dto/issue-installation-enrollment.response.dto";
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
    private readonly issueInstallationEnrollmentUseCase: IssueInstallationEnrollmentUseCase,
    private readonly revokeInstallationCredentialUseCase: RevokeInstallationCredentialUseCase,
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
    description:
      "PENDING -> ACTIVE is not available here; real activation only happens via a successful " +
      "machine enrollment (POST /installation-auth/enroll).",
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

  @Post(":id/enrollment")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.ENROLLMENT_MANAGE)
  @ApiOperation({
    summary: "Issue (or regenerate) the initial enrollment code for a PENDING installation",
    description:
      "Only PENDING installations are eligible. Any still-open enrollment code for this " +
      "installation is revoked first. The returned enrollmentCode is shown once.",
  })
  async issueInitialEnrollment(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<IssueInstallationEnrollmentResponseDto> {
    const result = await this.issueInstallationEnrollmentUseCase.execute({
      installationId: id,
      purpose: InstallationEnrollmentPurpose.INITIAL,
    });
    const dto = new IssueInstallationEnrollmentResponseDto();
    dto.installationId = result.installationId;
    dto.enrollmentCode = result.enrollmentCode;
    dto.expiresAt = result.expiresAt.toISOString();
    return dto;
  }

  @Post(":id/credentials/recovery-enrollment")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE)
  @ApiOperation({
    summary: "Issue a manual credential recovery/rekey enrollment code (ACTIVE or SUSPENDED only)",
    description:
      "For an installation whose credential was lost, compromised, or revoked. Never changes " +
      "Installation.status - a SUSPENDED installation stays SUSPENDED even after recovery-enrolling. " +
      "This is a manual, admin-triggered rekey, not periodic/automatic credential rotation (out of " +
      "scope). The returned enrollmentCode is shown once.",
  })
  async issueRecoveryEnrollment(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<IssueInstallationEnrollmentResponseDto> {
    const result = await this.issueInstallationEnrollmentUseCase.execute({
      installationId: id,
      purpose: InstallationEnrollmentPurpose.RECOVERY,
    });
    const dto = new IssueInstallationEnrollmentResponseDto();
    dto.installationId = result.installationId;
    dto.enrollmentCode = result.enrollmentCode;
    dto.expiresAt = result.expiresAt.toISOString();
    return dto;
  }

  @Post(":id/credentials/revoke")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Revoke the installation's active credential",
    description:
      "Idempotent - succeeds (204) even if there is no active credential. Never changes " +
      "Installation.status. Recovery back online requires a separate recovery-enrollment.",
  })
  async revokeCredential(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.revokeInstallationCredentialUseCase.execute({ installationId: id });
  }
}
