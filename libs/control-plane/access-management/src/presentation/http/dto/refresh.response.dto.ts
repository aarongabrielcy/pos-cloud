import { ApiProperty } from "@nestjs/swagger";

/** Never includes a refresh token - the rotated one is set as an HttpOnly cookie only. */
export class RefreshResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: "Bearer" }) tokenType!: string;
  @ApiProperty({ example: 900, description: "Access token TTL in seconds" }) expiresIn!: number;
}
