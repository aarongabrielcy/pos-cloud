import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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
@Controller("api/v1/installation-auth")
export class InstallationAuthController {
  constructor(private readonly enrollInstallationUseCase: EnrollInstallationUseCase) {}

  @Post("enroll")
  @InstallationEnrollment()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Consume a one-time enrollment code and obtain a permanent installation credential",
    description:
      "No Bearer token of any kind. The enrollment code in the request body is this endpoint's own " +
      "authentication mechanism. The returned credential is shown once and is never persisted in " +
      "plaintext - store it securely on the device.",
  })
  async enroll(@Body() body: EnrollInstallationRequestDto): Promise<EnrollInstallationResponseDto> {
    const result = await this.enrollInstallationUseCase.execute({
      enrollmentCode: body.enrollmentCode,
    });
    const dto = new EnrollInstallationResponseDto();
    dto.installationId = result.installationId;
    dto.credential = result.credential;
    return dto;
  }

  @Get("session")
  @InstallationAuthenticated()
  @ApiBearerAuth("installation-bearer")
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
