import { UnauthorizedError } from "@pos-cloud/shared-kernel";

/**
 * Single, generic, public-facing 401 for every refresh-token failure reason (missing cookie,
 * malformed token, unknown session, hash mismatch, expired, revoked/replayed). Never distinguish
 * these to the client - see docs/architecture/admin-authentication.md#refresh-token-rotation and
 * #replay-reuse-detection. Internal diagnosis (e.g. "replay detected") only ever reaches the
 * server-side log, never the response body.
 */
export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.");
  }
}
