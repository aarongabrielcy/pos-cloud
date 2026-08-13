import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import type { Response } from "express";
import { GetAdminProfileUseCase } from "../../application/use-cases/get-admin-profile.use-case";
import { LoginAdminUseCase } from "../../application/use-cases/login-admin.use-case";
import { LogoutAdminUseCase } from "../../application/use-cases/logout-admin.use-case";
import { RefreshAdminSessionUseCase } from "../../application/use-cases/refresh-admin-session.use-case";
import { InvalidRefreshTokenError } from "../../domain/admin-session.errors";
import { ApiErrorResponse } from "./decorators/api-error-response.decorator";
import { AuthenticatedOnly } from "./decorators/authenticated-only.decorator";
import { CurrentAdmin } from "./decorators/current-admin.decorator";
import { Public } from "./decorators/public.decorator";
import type { CurrentAdminPrincipal, RequestWithCurrentAdmin } from "./current-admin-principal";
import { AdminMeResponseDto } from "./dto/admin-me.response.dto";
import { LoginRequestDto } from "./dto/login.request.dto";
import { LoginResponseDto } from "./dto/login.response.dto";
import { RefreshResponseDto } from "./dto/refresh.response.dto";

/** Must match this controller's own route prefix - the refresh cookie is only ever sent back to /api/v1/auth/*. */
const AUTH_COOKIE_PATH = "/api/v1/auth";

@ApiTags("auth")
@ApiErrorResponse()
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly loginAdminUseCase: LoginAdminUseCase,
    private readonly refreshAdminSessionUseCase: RefreshAdminSessionUseCase,
    private readonly logoutAdminUseCase: LogoutAdminUseCase,
    private readonly getAdminProfileUseCase: GetAdminProfileUseCase,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiOperation({
    summary: "Admin login",
    description:
      "Sets an HttpOnly refresh cookie (never returned in the JSON body) and returns a short-lived Bearer access token.",
  })
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginAdminUseCase.execute(body);
    this.setRefreshCookie(res, result.refreshToken);

    const dto = new LoginResponseDto();
    dto.accessToken = result.accessToken;
    dto.tokenType = "Bearer";
    dto.expiresIn = result.expiresInSeconds;
    dto.user = result.user;
    return dto;
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiOperation({
    summary: "Rotate the refresh session",
    description: "Reads the HttpOnly refresh cookie, rotates it, and returns a new access token.",
  })
  async refresh(
    @Req() req: RequestWithCurrentAdmin,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const rawRefreshToken = this.readRefreshCookie(req);
    if (!rawRefreshToken) {
      throw new InvalidRefreshTokenError();
    }

    const result = await this.refreshAdminSessionUseCase.execute({ rawRefreshToken });
    this.setRefreshCookie(res, result.refreshToken);

    const dto = new RefreshResponseDto();
    dto.accessToken = result.accessToken;
    dto.tokenType = "Bearer";
    dto.expiresIn = result.expiresInSeconds;
    return dto;
  }

  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: "Logged out - cookie cleared. Idempotent." })
  @ApiOperation({
    summary: "Logout",
    description: "Revokes the current refresh session (if any) and clears the cookie. Idempotent.",
  })
  async logout(
    @Req() req: RequestWithCurrentAdmin,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawRefreshToken = this.readRefreshCookie(req);
    await this.logoutAdminUseCase.execute({ rawRefreshToken });
    this.clearRefreshCookie(res);
  }

  @Get("me")
  @AuthenticatedOnly()
  @ApiBearerAuth("admin-bearer")
  @ApiOkResponse({ type: AdminMeResponseDto })
  @ApiOperation({ summary: "Current authenticated admin's public profile" })
  async me(@CurrentAdmin() currentAdmin: CurrentAdminPrincipal): Promise<AdminMeResponseDto> {
    const profile = await this.getAdminProfileUseCase.execute({
      adminUserId: currentAdmin.adminUserId,
    });
    return AdminMeResponseDto.fromProfile(profile);
  }

  private readRefreshCookie(req: RequestWithCurrentAdmin): string | undefined {
    const cookies = (req as { cookies?: Record<string, string> }).cookies;
    return cookies?.[this.authConfig.refreshCookieName];
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: { sessionId: string; secret: string },
  ): void {
    res.cookie(
      this.authConfig.refreshCookieName,
      `${refreshToken.sessionId}.${refreshToken.secret}`,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: this.authConfig.secureCookies,
        path: AUTH_COOKIE_PATH,
        maxAge: this.authConfig.refreshTokenTtlSeconds * 1000,
      },
    );
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.authConfig.refreshCookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.authConfig.secureCookies,
      path: AUTH_COOKIE_PATH,
    });
  }
}
