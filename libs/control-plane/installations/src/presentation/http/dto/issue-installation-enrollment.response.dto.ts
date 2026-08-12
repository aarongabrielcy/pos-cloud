import { ApiProperty } from "@nestjs/swagger";

/** The `enrollmentCode` value is returned once - it is not persisted in plaintext and cannot be recovered later. */
export class IssueInstallationEnrollmentResponseDto {
  @ApiProperty() installationId!: string;
  @ApiProperty({
    description: "The one-time enrollment code, in <enrollmentId>.<secret> form. Returned once.",
  })
  enrollmentCode!: string;
  @ApiProperty() expiresAt!: string;
}
