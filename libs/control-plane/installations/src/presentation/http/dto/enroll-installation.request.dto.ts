import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class EnrollInstallationRequestDto {
  @ApiProperty({
    description: "The one-time enrollment code, in <enrollmentId>.<secret> form.",
    example: "3fa85f64-5717-4562-b3fc-2c963f66afa6.k3f9…",
  })
  @IsString()
  @Length(1, 512)
  enrollmentCode!: string;
}
