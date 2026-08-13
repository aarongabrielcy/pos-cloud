import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RecordInstallationHeartbeatUseCase } from "../../application/use-cases/record-installation-heartbeat.use-case";
import { CurrentInstallation } from "./decorators/current-installation.decorator";
import type { CurrentInstallationPrincipal } from "./current-installation-principal";
import { InstallationAuthenticated } from "./decorators/installation-authenticated.decorator";
import { RecordHeartbeatRequestDto } from "./dto/record-heartbeat.request.dto";

/**
 * Machine identity plane - installation-bearer only, never admin-bearer (mirrors
 * InstallationAuthController's own separation). `installationId` comes exclusively from the
 * already-authenticated @CurrentInstallation() principal - a body-supplied id is never accepted, so
 * one installation can never report a heartbeat on behalf of another. See
 * docs/architecture/installation-health.md#heartbeat-endpoint.
 */
@ApiTags("installation-health")
@Controller("api/v1/installation-health")
export class InstallationHealthController {
  constructor(
    private readonly recordInstallationHeartbeatUseCase: RecordInstallationHeartbeatUseCase,
  ) {}

  @Post("heartbeat")
  @InstallationAuthenticated()
  @ApiBearerAuth("installation-bearer")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Report a heartbeat for the authenticated installation",
    description:
      "204 No Content - no server-to-POS payload exists yet worth returning. lastSeenAt is always " +
      "server-received time; clientReportedAt is diagnostic only.",
  })
  async heartbeat(
    @Body() body: RecordHeartbeatRequestDto,
    @CurrentInstallation() currentInstallation: CurrentInstallationPrincipal,
  ): Promise<void> {
    await this.recordInstallationHeartbeatUseCase.execute({
      installationId: currentInstallation.installationId,
      appVersion: body.appVersion,
      clientReportedAt: body.clientReportedAt ? new Date(body.clientReportedAt) : null,
    });
  }
}
