import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import type {
  AccessTokenIssuerPort,
  AccessTokenPayload,
  AccessTokenVerifierPort,
  IssuedAccessToken,
  VerifiedAccessToken,
} from "../../application/ports/access-token.port";

/** Distinguishes this JWT from any future token type this bounded context might issue later (e.g. CLOUD-01C-B). */
const TOKEN_TYPE = "admin_access";

interface JwtClaims {
  sub: string;
  sid: string;
  typ: string;
}

/**
 * HS256, algorithm pinned explicitly on both sign and verify (never "none", never accepted from the
 * token header) - see docs/architecture/admin-authentication.md#access-token. `JwtService` is used
 * directly (no `JwtModule.register(...)`): the secret/issuer/audience/TTL all come from AuthConfig
 * per call instead of a module-level default, since AccessManagementModule (a library) must not own
 * process configuration - see AccessManagementModule's own comment.
 */
@Injectable()
export class JwtAccessTokenAdapter implements AccessTokenIssuerPort, AccessTokenVerifierPort {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  async issue(payload: AccessTokenPayload): Promise<IssuedAccessToken> {
    const token = await this.jwtService.signAsync(
      { sub: payload.sub, sid: payload.sid, typ: TOKEN_TYPE } satisfies JwtClaims,
      {
        secret: this.authConfig.jwt.secret,
        issuer: this.authConfig.jwt.issuer,
        audience: this.authConfig.jwt.audience,
        expiresIn: this.authConfig.accessTokenTtlSeconds,
        algorithm: "HS256",
      },
    );
    return { token, expiresInSeconds: this.authConfig.accessTokenTtlSeconds };
  }

  async verify(token: string): Promise<VerifiedAccessToken | null> {
    try {
      const claims = await this.jwtService.verifyAsync<JwtClaims>(token, {
        secret: this.authConfig.jwt.secret,
        issuer: this.authConfig.jwt.issuer,
        audience: this.authConfig.jwt.audience,
        algorithms: ["HS256"],
      });

      if (
        claims.typ !== TOKEN_TYPE ||
        typeof claims.sub !== "string" ||
        typeof claims.sid !== "string"
      ) {
        return null;
      }

      return { adminUserId: claims.sub, sessionId: claims.sid };
    } catch {
      return null;
    }
  }
}
