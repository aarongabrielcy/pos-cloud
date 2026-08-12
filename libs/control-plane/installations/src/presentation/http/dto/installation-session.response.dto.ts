import { ApiProperty } from "@nestjs/swagger";

/** Minimal identity/session-validation response - only what InstallationAuthGuard already attached to the request. */
export class InstallationSessionResponseDto {
  @ApiProperty() installationId!: string;
}
