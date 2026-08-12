import { Module } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ADMIN_ROLE_REPOSITORY } from "./application/ports/admin-role-repository.port";
import { ACCESS_TOKEN_ISSUER, ACCESS_TOKEN_VERIFIER } from "./application/ports/access-token.port";
import { ADMIN_SESSION_UNIT_OF_WORK } from "./application/ports/admin-session-unit-of-work.port";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port";
import { PERMISSION_RESOLVER } from "./application/ports/permission-resolver.port";
import { REFRESH_TOKEN_GENERATOR } from "./application/ports/refresh-token-generator.port";
import { AssignRoleToAdminUseCase } from "./application/use-cases/assign-role-to-admin.use-case";
import { BootstrapFirstAdminUseCase } from "./application/use-cases/bootstrap-first-admin.use-case";
import { GetAdminProfileUseCase } from "./application/use-cases/get-admin-profile.use-case";
import { LoginAdminUseCase } from "./application/use-cases/login-admin.use-case";
import { LogoutAdminUseCase } from "./application/use-cases/logout-admin.use-case";
import { RefreshAdminSessionUseCase } from "./application/use-cases/refresh-admin-session.use-case";
import { ADMIN_SESSION_REPOSITORY } from "./domain/admin-session-repository.port";
import { ADMIN_USER_REPOSITORY } from "./domain/admin-user-repository.port";
import { AdminRoleRecord } from "./infrastructure/persistence/admin-role.record";
import { AdminSessionRecord } from "./infrastructure/persistence/admin-session.record";
import { AdminUserRoleRecord } from "./infrastructure/persistence/admin-user-role.record";
import { AdminUserRecord } from "./infrastructure/persistence/admin-user.record";
import { PermissionRecord } from "./infrastructure/persistence/permission.record";
import { RolePermissionRecord } from "./infrastructure/persistence/role-permission.record";
import { TypeOrmAdminRoleRepository } from "./infrastructure/persistence/typeorm-admin-role.repository";
import { TypeOrmAdminSessionUnitOfWork } from "./infrastructure/persistence/typeorm-admin-session-unit-of-work";
import { TypeOrmAdminSessionRepository } from "./infrastructure/persistence/typeorm-admin-session.repository";
import { TypeOrmAdminUserRepository } from "./infrastructure/persistence/typeorm-admin-user.repository";
import { TypeOrmPermissionResolverAdapter } from "./infrastructure/persistence/typeorm-permission-resolver.adapter";
import { Argon2PasswordHasher } from "./infrastructure/security/argon2-password-hasher.adapter";
import { CryptoRefreshTokenGenerator } from "./infrastructure/security/crypto-refresh-token-generator.adapter";
import { JwtAccessTokenAdapter } from "./infrastructure/security/jwt-access-token.adapter";
import { AuthController } from "./presentation/http/auth.controller";
import { AccessTokenGuard } from "./presentation/http/guards/access-token.guard";
import { AdminAuthorizationGuard } from "./presentation/http/guards/admin-authorization.guard";

/**
 * Public NestJS module for the Access Management bounded context: admin identity + authentication
 * (CLOUD-01C-A) and RBAC/authorization (CLOUD-01C-B). `AUTH_CONFIG` is injected but NOT bound here -
 * the composition root (apps/api) provides it globally, exactly like `APP_CONFIG` (see
 * apps/api/src/auth/auth-config.module.ts) - this module only declares that it needs it, the same
 * pattern Installations/Licensing use for their own cross-context ports (see docs/architecture/
 * control-plane-core.md). `JwtService` is provided directly (no `JwtModule.register(...)`) since
 * every secret/TTL/issuer/audience value it needs comes from AuthConfig per call - see
 * JwtAccessTokenAdapter's own comment.
 *
 * `AccessTokenGuard`/`AdminAuthorizationGuard` are exported (not just provided) so ControlPlaneModule
 * (apps/api) can register them as global `APP_GUARD`s - see that module's own comment and
 * docs/architecture/admin-rbac.md#guards. `PermissionRecord`/`AdminRoleRecord`/`RolePermissionRecord`
 * are registered in `forFeature` purely so `autoLoadEntities` picks them up for `migration:generate` -
 * nothing injects their repositories (see each record's own comment).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUserRecord,
      AdminSessionRecord,
      AdminUserRoleRecord,
      PermissionRecord,
      AdminRoleRecord,
      RolePermissionRecord,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    { provide: ADMIN_USER_REPOSITORY, useClass: TypeOrmAdminUserRepository },
    { provide: ADMIN_SESSION_REPOSITORY, useClass: TypeOrmAdminSessionRepository },
    { provide: ADMIN_SESSION_UNIT_OF_WORK, useClass: TypeOrmAdminSessionUnitOfWork },
    { provide: ADMIN_ROLE_REPOSITORY, useClass: TypeOrmAdminRoleRepository },
    { provide: PERMISSION_RESOLVER, useClass: TypeOrmPermissionResolverAdapter },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_TOKEN_GENERATOR, useClass: CryptoRefreshTokenGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    JwtService,
    JwtAccessTokenAdapter,
    { provide: ACCESS_TOKEN_ISSUER, useExisting: JwtAccessTokenAdapter },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: JwtAccessTokenAdapter },
    LoginAdminUseCase,
    RefreshAdminSessionUseCase,
    LogoutAdminUseCase,
    GetAdminProfileUseCase,
    AssignRoleToAdminUseCase,
    BootstrapFirstAdminUseCase,
    AccessTokenGuard,
    AdminAuthorizationGuard,
  ],
  exports: [BootstrapFirstAdminUseCase, AccessTokenGuard, AdminAuthorizationGuard],
})
export class AccessManagementModule {}
