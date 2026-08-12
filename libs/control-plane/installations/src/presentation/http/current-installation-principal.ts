import type { Request } from "express";

export interface CurrentInstallationPrincipal {
  installationId: string;
}

export type RequestWithCurrentInstallation = Request & {
  currentInstallation?: CurrentInstallationPrincipal;
};
