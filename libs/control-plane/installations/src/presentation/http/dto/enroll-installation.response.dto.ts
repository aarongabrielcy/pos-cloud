import { ApiProperty } from "@nestjs/swagger";

/** The `credential` value is returned once - it is not persisted in plaintext and cannot be recovered later. Must be stored securely by the caller. */
export class EnrollInstallationResponseDto {
  @ApiProperty() installationId!: string;
  @ApiProperty({
    description:
      "The permanent installation credential, in <credentialId>.<secret> form. Returned once.",
  })
  credential!: string;
}
