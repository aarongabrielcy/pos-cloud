import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { AdminSession } from "../../domain/admin-session";
import { AdminSessionId } from "../../domain/admin-session-id";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminSessionStore } from "../../test-support/in-memory-admin-session-store";
import { LogoutAdminUseCase } from "./logout-admin.use-case";

async function setup() {
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const sessions = new InMemoryAdminSessionStore();
  const useCase = new LogoutAdminUseCase(sessions, clock);
  const idGenerator = new RandomUuidGenerator();

  const sessionId = idGenerator.next();
  const session = AdminSession.create(
    {
      id: sessionId,
      adminUserId: idGenerator.next(),
      refreshTokenHash: "irrelevant-for-logout",
      expiresAt: new Date(clock.now().getTime() + 60_000),
    },
    clock,
  );
  await sessions.save(session);

  return { useCase, sessions, sessionId };
}

describe("LogoutAdminUseCase", () => {
  it("revokes the session identified by the cookie's sessionId", async () => {
    const { useCase, sessions, sessionId } = await setup();

    await useCase.execute({ rawRefreshToken: `${sessionId}.any-secret-not-checked` });

    const session = await sessions.findById(AdminSessionId.of(sessionId));
    expect(session?.isRevoked()).toBe(true);
  });

  it("is a no-op (idempotent) when no cookie was sent", async () => {
    const { useCase } = await setup();
    await expect(useCase.execute({})).resolves.toBeUndefined();
  });

  it("is a no-op (idempotent) for a malformed token", async () => {
    const { useCase } = await setup();
    await expect(
      useCase.execute({ rawRefreshToken: "no-separator-here" }),
    ).resolves.toBeUndefined();
  });

  it("is a no-op (idempotent) for an unknown sessionId", async () => {
    const { useCase } = await setup();
    await expect(
      useCase.execute({ rawRefreshToken: "00000000-0000-4000-8000-000000000000.secret" }),
    ).resolves.toBeUndefined();
  });

  it("is a no-op calling logout twice for the same session", async () => {
    const { useCase, sessions, sessionId } = await setup();

    await useCase.execute({ rawRefreshToken: `${sessionId}.secret` });
    await useCase.execute({ rawRefreshToken: `${sessionId}.secret` });

    const session = await sessions.findById(AdminSessionId.of(sessionId));
    expect(session?.isRevoked()).toBe(true);
  });
});
