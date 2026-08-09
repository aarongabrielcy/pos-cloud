import type { EnvSchema } from "./env.schema";

export interface AppConfig {
  readonly env: EnvSchema["NODE_ENV"];
  readonly app: {
    readonly name: string;
    readonly port: number;
  };
  readonly database: {
    readonly host: string;
    readonly port: number;
    readonly name: string;
    readonly user: string;
    readonly password: string;
  };
  readonly redis: {
    readonly host: string;
    readonly port: number;
  };
  readonly logging: {
    readonly level: EnvSchema["LOG_LEVEL"];
  };
}
