import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ApiErrorResponse } from "@pos-cloud/access-management";
import type { AuditRequestContext } from "@pos-cloud/shared-kernel";
import type { Request } from "express";
import { EnrollInstallationUseCase } from "../../application/use-cases/enroll-installation.use-case";
import { InstallationAuthenticated } from "./decorators/installation-authenticated.decorator";
import { InstallationEnrollment } from "./decorators/installation-enrollment.decorator";
import { CurrentInstallation } from "./decorators/current-installation.decorator";
import type { CurrentInstallationPrincipal } from "./current-installation-principal";
import { EnrollInstallationRequestDto } from "./dto/enroll-installation.request.dto";
import { EnrollInstallationResponseDto } from "./dto/enroll-installation.response.dto";
import { InstallationSessionResponseDto } from "./dto/installation-session.response.dto";

/**
 * Machine identity plane - completely separate from AuthController (AdminUser identity). Neither
 * endpoint here accepts or reads an admin Bearer token; `enroll` accepts no credential at all (the
 * enrollment code IS the credential for that one call), `session` accepts only an installation
 * Bearer credential. See docs/architecture/installation-enrollment.md#principles.
 */
@ApiTags("installation-auth")
@ApiErrorResponse()
@Controller("api/v1/installation-auth")
export class InstallationAuthController {
  constructor(private readonly enrollInstallationUseCase: EnrollInstallationUseCase) {}

  @Post("enroll")
  @InstallationEnrollment()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: EnrollInstallationResponseDto })
  @ApiOperation({
    summary: "Consume a one-time enrollment code and obtain a permanent installation credential",
    description:
      "No Bearer token of any kind. The enrollment code in the request body is this endpoint's own " +
      "authentication mechanism. The returned credential is shown once and is never persisted in " +
      "plaintext - store it securely on the device.",
  })
  async enroll(
    @Body() body: EnrollInstallationRequestDto,
    @Req() request: Request & { id?: string | number },
  ): Promise<EnrollInstallationResponseDto> {
    // No @CurrentInstallation() here - the Installation is still authenticating via the enrollment
    // code, so only correlationId is known up front. See EnrollInstallationUseCase's own comment for
    // how it resolves and audits the real actor internally.
    const requestContext: AuditRequestContext = {
      correlationId: request.id !== undefined ? String(request.id) : "unknown",
    };
    const result = await this.enrollInstallationUseCase.execute(
      { enrollmentCode: body.enrollmentCode },
      requestContext,
    );
    const dto = new EnrollInstallationResponseDto();
    dto.installationId = result.installationId;
    dto.credential = result.credential;
    return dto;
  }

  @Get("session")
  @InstallationAuthenticated()
  @ApiBearerAuth("installation-bearer")
  @ApiOkResponse({ type: InstallationSessionResponseDto })
  @ApiOperation({
    summary: "Minimal identity/session validation",
    description:
      "Proves the installation-credential authentication pipeline end-to-end. No other consumer in " +
      "CLOUD-01C-C; CLOUD-01C-D's heartbeat will reuse this same infrastructure.",
  })
  async session(
    @CurrentInstallation() currentInstallation: CurrentInstallationPrincipal,
  ): Promise<InstallationSessionResponseDto> {
    const dto = new InstallationSessionResponseDto();
    dto.installationId = currentInstallation.installationId;
    return dto;
  }
}
