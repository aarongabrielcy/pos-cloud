import { ApiProperty } from "@nestjs/swagger";
import { AdminUserStatus } from "../../../domain/admin-user-status";

class LoginResponseUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: AdminUserStatus }) status!: AdminUserStatus;
}

/** Never includes a refresh token - that is set as an HttpOnly cookie only, never returned in JSON (see AuthController.setRefreshCookie). */
export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: "Bearer" }) tokenType!: string;
  @ApiProperty({ example: 900, description: "Access token TTL in seconds" }) expiresIn!: number;
  @ApiProperty({ type: LoginResponseUserDto }) user!: LoginResponseUserDto;
}
