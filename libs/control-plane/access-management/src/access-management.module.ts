import { Module } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ACCESS_TOKEN_ISSUER, ACCESS_TOKEN_VERIFIER } from "./application/ports/access-token.port";
import { ADMIN_SESSION_UNIT_OF_WORK } from "./application/ports/admin-session-unit-of-work.port";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port";
import { REFRESH_TOKEN_GENERATOR } from "./application/ports/refresh-token-generator.port";
import { BootstrapFirstAdminUseCase } from "./application/use-cases/bootstrap-first-admin.use-case";
import { GetAdminProfileUseCase } from "./application/use-cases/get-admin-profile.use-case";
import { LoginAdminUseCase } from "./application/use-cases/login-admin.use-case";
import { LogoutAdminUseCase } from "./application/use-cases/logout-admin.use-case";
import { RefreshAdminSessionUseCase } from "./application/use-cases/refresh-admin-session.use-case";
import { ADMIN_SESSION_REPOSITORY } from "./domain/admin-session-repository.port";
import { ADMIN_USER_REPOSITORY } from "./domain/admin-user-repository.port";
import { AdminSessionRecord } from "./infrastructure/persistence/admin-session.record";
import { AdminUserRecord } from "./infrastructure/persistence/admin-user.record";
import { TypeOrmAdminSessionUnitOfWork } from "./infrastructure/persistence/typeorm-admin-session-unit-of-work";
import { TypeOrmAdminSessionRepository } from "./infrastructure/persistence/typeorm-admin-session.repository";
import { TypeOrmAdminUserRepository } from "./infrastructure/persistence/typeorm-admin-user.repository";
import { Argon2PasswordHasher } from "./infrastructure/security/argon2-password-hasher.adapter";
import { CryptoRefreshTokenGenerator } from "./infrastructure/security/crypto-refresh-token-generator.adapter";
import { JwtAccessTokenAdapter } from "./infrastructure/security/jwt-access-token.adapter";
import { AuthController } from "./presentation/http/auth.controller";
import { AccessTokenGuard } from "./presentation/http/guards/access-token.guard";

/**
 * Public NestJS module for the Access Management bounded context (CLOUD-01C-A: admin identity +
 * authentication foundation). `AUTH_CONFIG` is injected but NOT bound here - the composition root
 * (apps/api) provides it globally, exactly like `APP_CONFIG` (see apps/api/src/auth/
 * auth-config.module.ts) - this module only declares that it needs it, the same pattern
 * Installations/Licensing use for their own cross-context ports (see docs/architecture/
 * control-plane-core.md). `JwtService` is provided directly (no `JwtModule.register(...)`) since
 * every secret/TTL/issuer/audience value it needs comes from AuthConfig per call - see
 * JwtAccessTokenAdapter's own comment.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AdminUserRecord, AdminSessionRecord])],
  controllers: [AuthController],
  providers: [
    { provide: ADMIN_USER_REPOSITORY, useClass: TypeOrmAdminUserRepository },
    { provide: ADMIN_SESSION_REPOSITORY, useClass: TypeOrmAdminSessionRepository },
    { provide: ADMIN_SESSION_UNIT_OF_WORK, useClass: TypeOrmAdminSessionUnitOfWork },
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
    BootstrapFirstAdminUseCase,
    AccessTokenGuard,
  ],
  exports: [BootstrapFirstAdminUseCase],
})
export class AccessManagementModule {}
