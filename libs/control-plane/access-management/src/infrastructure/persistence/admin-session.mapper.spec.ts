import { randomUUID } from "node:crypto";
import { AdminSession } from "../../domain/admin-session";
import { AdminSessionId } from "../../domain/admin-session-id";
import { FixedClock } from "../../test-support/fixed-clock";
import { AdminSessionMapper } from "./admin-session.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("AdminSessionMapper", () => {
  it("round-trips an AdminSession through toRecord/toDomain", () => {
    const original = AdminSession.create(
      {
        id: randomUUID(),
        adminUserId: randomUUID(),
        refreshTokenHash: "sha256-fake-hash",
        expiresAt: new Date("2026-01-08T00:00:00.000Z"),
      },
      clock,
    );

    const rehydrated = AdminSessionMapper.toDomain(AdminSessionMapper.toRecord(original));

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.adminUserId).toBe(original.adminUserId);
    expect(rehydrated.refreshTokenHash).toBe("sha256-fake-hash");
    expect(rehydrated.replacedBySessionId).toBeNull();
  });

  it("preserves replacedBySessionId after rotation", () => {
    const original = AdminSession.create(
      {
        id: randomUUID(),
        adminUserId: randomUUID(),
        refreshTokenHash: "sha256-fake-hash",
        expiresAt: new Date("2026-01-08T00:00:00.000Z"),
      },
      clock,
    );
    const replacement = AdminSessionId.of(randomUUID());
    original.revoke(clock, replacement);

    const rehydrated = AdminSessionMapper.toDomain(AdminSessionMapper.toRecord(original));

    expect(rehydrated.isRevoked()).toBe(true);
    expect(rehydrated.replacedBySessionId?.equals(replacement)).toBe(true);
  });
});
