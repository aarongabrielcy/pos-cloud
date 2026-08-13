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
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { ChangeInstallationStatusUseCase } from "../../application/use-cases/change-installation-status.use-case";
import { CreateInstallationUseCase } from "../../application/use-cases/create-installation.use-case";
import { GetInstallationByIdUseCase } from "../../application/use-cases/get-installation-by-id.use-case";
import { GetInstallationHealthUseCase } from "../../application/use-cases/get-installation-health.use-case";
import { IssueInstallationEnrollmentUseCase } from "../../application/use-cases/issue-installation-enrollment.use-case";
import { ListInstallationsUseCase } from "../../application/use-cases/list-installations.use-case";
import { RevokeInstallationCredentialUseCase } from "../../application/use-cases/revoke-installation-credential.use-case";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationNotFoundError } from "../../domain/installation.errors";
import { ChangeInstallationStatusRequestDto } from "./dto/change-installation-status.request.dto";
import { CreateInstallationRequestDto } from "./dto/create-installation.request.dto";
import { InstallationHealthResponseDto } from "./dto/installation-health.response.dto";
import { InstallationListItemResponseDto } from "./dto/installation-list-item.response.dto";
import { InstallationListResponseDto } from "./dto/installation-list.response.dto";
import { InstallationResponseDto } from "./dto/installation.response.dto";
import { IssueInstallationEnrollmentResponseDto } from "./dto/issue-installation-enrollment.response.dto";
import { ListInstallationsQueryDto } from "./dto/list-installations.query.dto";

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

@ApiTags("installations")
@ApiBearerAuth("admin-bearer")
@ApiErrorResponse()
@Controller("api/v1/control-plane/installations")
export class InstallationController {
  constructor(
    private readonly createInstallationUseCase: CreateInstallationUseCase,
    private readonly getInstallationByIdUseCase: GetInstallationByIdUseCase,
    private readonly listInstallationsUseCase: ListInstallationsUseCase,
    private readonly changeInstallationStatusUseCase: ChangeInstallationStatusUseCase,
    private readonly issueInstallationEnrollmentUseCase: IssueInstallationEnrollmentUseCase,
    private readonly revokeInstallationCredentialUseCase: RevokeInstallationCredentialUseCase,
    private readonly getInstallationHealthUseCase: GetInstallationHealthUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.CREATE)
  @ApiCreatedResponse({ type: InstallationResponseDto })
  @ApiOperation({ summary: "Create an installation (starts PENDING)" })
  async create(
    @Body() body: CreateInstallationRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<InstallationResponseDto> {
    const installation = await this.createInstallationUseCase.execute(
      body,
      buildAdminAuditActor(admin, request),
    );
    return InstallationResponseDto.fromDomain(installation);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.READ)
  @ApiOkResponse({ type: InstallationResponseDto })
  @ApiOperation({ summary: "Get an installation by id" })
  async getById(@Param("id", ParseUUIDPipe) id: string): Promise<InstallationResponseDto> {
    const installation = await this.getInstallationByIdUseCase.execute(id);
    if (!installation) {
      throw new InstallationNotFoundError(id);
    }
    return InstallationResponseDto.fromDomain(installation);
  }

  @Get(":id/health")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.READ)
  @ApiOkResponse({ type: InstallationHealthResponseDto })
  @ApiOperation({
    summary: "Get an installation's operational health",
    description:
      "healthStatus is computed at read time from lastSeenAt (never persisted) - see " +
      "docs/architecture/installation-health.md. Always a separate field from lifecycleStatus: " +
      "ACTIVE + OFFLINE is a valid, common combination, not a contradiction.",
  })
  async getHealth(@Param("id", ParseUUIDPipe) id: string): Promise<InstallationHealthResponseDto> {
    const detail = await this.getInstallationHealthUseCase.execute(id);
    if (!detail) {
      throw new InstallationNotFoundError(id);
    }
    return InstallationHealthResponseDto.fromDetail(detail);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.READ)
  @ApiOkResponse({ type: InstallationListResponseDto })
  @ApiOperation({ summary: "List installations" })
  async list(@Query() query: ListInstallationsQueryDto): Promise<InstallationListResponseDto> {
    const result = await this.listInstallationsUseCase.execute(query);
    return {
      items: result.items.map(InstallationListItemResponseDto.fromListItem),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.STATUS_CHANGE)
  @ApiOkResponse({ type: InstallationResponseDto })
  @ApiOperation({
    summary: "Administrative status change",
    description:
      "PENDING -> ACTIVE is not available here; real activation only happens via a successful " +
      "machine enrollment (POST /installation-auth/enroll).",
  })
  async changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ChangeInstallationStatusRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<InstallationResponseDto> {
    const installation = await this.changeInstallationStatusUseCase.execute(
      { id, status: body.status },
      buildAdminAuditActor(admin, request),
    );
    return InstallationResponseDto.fromDomain(installation);
  }

  @Post(":id/enrollment")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.ENROLLMENT_MANAGE)
  @ApiCreatedResponse({ type: IssueInstallationEnrollmentResponseDto })
  @ApiOperation({
    summary: "Issue (or regenerate) the initial enrollment code for a PENDING installation",
    description:
      "Only PENDING installations are eligible. Any still-open enrollment code for this " +
      "installation is revoked first. The returned enrollmentCode is shown once.",
  })
  async issueInitialEnrollment(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<IssueInstallationEnrollmentResponseDto> {
    const result = await this.issueInstallationEnrollmentUseCase.execute(
      { installationId: id, purpose: InstallationEnrollmentPurpose.INITIAL },
      buildAdminAuditActor(admin, request),
    );
    const dto = new IssueInstallationEnrollmentResponseDto();
    dto.installationId = result.installationId;
    dto.enrollmentCode = result.enrollmentCode;
    dto.expiresAt = result.expiresAt.toISOString();
    return dto;
  }

  @Post(":id/credentials/recovery-enrollment")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE)
  @ApiCreatedResponse({ type: IssueInstallationEnrollmentResponseDto })
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
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<IssueInstallationEnrollmentResponseDto> {
    const result = await this.issueInstallationEnrollmentUseCase.execute(
      { installationId: id, purpose: InstallationEnrollmentPurpose.RECOVERY },
      buildAdminAuditActor(admin, request),
    );
    const dto = new IssueInstallationEnrollmentResponseDto();
    dto.installationId = result.installationId;
    dto.enrollmentCode = result.enrollmentCode;
    dto.expiresAt = result.expiresAt.toISOString();
    return dto;
  }

  @Post(":id/credentials/revoke")
  @RequirePermissions(PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: "Credential revoked (or already had none - idempotent).",
  })
  @ApiOperation({
    summary: "Revoke the installation's active credential",
    description:
      "Idempotent - succeeds (204) even if there is no active credential. Never changes " +
      "Installation.status. Recovery back online requires a separate recovery-enrollment.",
  })
  async revokeCredential(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<void> {
    await this.revokeInstallationCredentialUseCase.execute(
      { installationId: id },
      buildAdminAuditActor(admin, request),
    );
  }
}
