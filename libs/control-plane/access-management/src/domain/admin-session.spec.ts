import { randomUUID } from "node:crypto";
import { FixedClock } from "../test-support/fixed-clock";
import { AdminSession } from "./admin-session";
import { AdminSessionId } from "./admin-session-id";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function createSession(expiresInMs = 60 * 60 * 1000) {
  return AdminSession.create(
    {
      id: randomUUID(),
      adminUserId: randomUUID(),
      refreshTokenHash: "sha256-fake-hash",
      expiresAt: new Date(clock.now().getTime() + expiresInMs),
    },
    clock,
  );
}

describe("AdminSession", () => {
  it("starts active: not revoked, not expired", () => {
    const session = createSession();
    expect(session.isRevoked()).toBe(false);
    expect(session.isExpired(clock.now())).toBe(false);
    expect(session.isActive(clock.now())).toBe(true);
  });

  it("is expired once now passes expiresAt", () => {
    const session = createSession(1000);
    const later = new Date(clock.now().getTime() + 2000);
    expect(session.isExpired(later)).toBe(true);
    expect(session.isActive(later)).toBe(false);
  });

  it("revoke() marks the session revoked and inactive", () => {
    const session = createSession();
    session.revoke(clock);
    expect(session.isRevoked()).toBe(true);
    expect(session.isActive(clock.now())).toBe(false);
    expect(session.revokedAt).toEqual(clock.now());
  });

  it("revoke() can record the replacing session id (rotation chain)", () => {
    const session = createSession();
    const replacement = AdminSessionId.of(randomUUID());
    session.revoke(clock, replacement);
    expect(session.replacedBySessionId).toBe(replacement);
  });

  it("touch() updates lastUsedAt", () => {
    const session = createSession();
    const later = new FixedClock(new Date(clock.now().getTime() + 5000));
    session.touch(later);
    expect(session.lastUsedAt).toEqual(later.now());
  });
});
