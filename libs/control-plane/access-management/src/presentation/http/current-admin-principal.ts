import type { Request } from "express";

export interface CurrentAdminPrincipal {
  adminUserId: string;
  sessionId: string;
}

export type RequestWithCurrentAdmin = Request & { currentAdmin?: CurrentAdminPrincipal };
