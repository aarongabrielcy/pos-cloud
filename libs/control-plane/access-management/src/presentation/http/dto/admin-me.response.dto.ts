import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AdminProfile } from "../../../application/use-cases/get-admin-profile.use-case";
import { AdminUserStatus } from "../../../domain/admin-user-status";

/** Deliberately excludes passwordHash and any session data - see GetAdminProfileUseCase's own comment. */
export class AdminMeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: AdminUserStatus }) status!: AdminUserStatus;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({
    type: [String],
    description:
      "Effective permission codes (union across every role assigned to this admin), sorted " +
      "lexicographically. Not roles - the frontend must treat this as the final capability list, " +
      "never re-derive it from a role name. The backend remains the sole authority: every " +
      "permission-gated request is still checked server-side regardless of what this array says.",
    example: ["audit.read", "customers.create", "customers.read"],
  })
  permissions!: string[];

  static fromProfile(profile: AdminProfile): AdminMeResponseDto {
    const dto = new AdminMeResponseDto();
    dto.id = profile.id;
    dto.email = profile.email;
    dto.displayName = profile.displayName;
    dto.status = profile.status;
    dto.createdAt = profile.createdAt.toISOString();
    dto.lastLoginAt = profile.lastLoginAt?.toISOString() ?? null;
    dto.permissions = [...profile.permissions];
    return dto;
  }
}
