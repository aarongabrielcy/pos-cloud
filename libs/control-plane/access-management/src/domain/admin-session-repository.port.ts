import type { AdminSession } from "./admin-session";
import type { AdminSessionId } from "./admin-session-id";

/**
 * Plain (non-transactional) session persistence - used by LoginAdminUseCase (create) and
 * LogoutAdminUseCase (find + revoke). The refresh-rotation flow needs stronger atomicity guarantees
 * than this port provides - see AdminSessionUnitOfWork (application/ports) for that.
 */
export interface AdminSessionRepository {
  findById(id: AdminSessionId): Promise<AdminSession | null>;
  save(session: AdminSession): Promise<void>;
}

export const ADMIN_SESSION_REPOSITORY = Symbol("ADMIN_SESSION_REPOSITORY");
