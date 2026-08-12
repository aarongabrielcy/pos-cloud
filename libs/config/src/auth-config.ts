export interface AuthConfig {
  readonly jwt: {
    readonly secret: string;
    readonly issuer: string;
    readonly audience: string;
  };
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly refreshCookieName: string;
  /** Cookie `Secure` attribute: true when NODE_ENV=production, false otherwise (e.g. local development over plain HTTP). */
  readonly secureCookies: boolean;
}

/** DI token for injecting AuthConfig in frameworks (e.g. NestJS) that resolve by token. */
export const AUTH_CONFIG = Symbol("AUTH_CONFIG");
