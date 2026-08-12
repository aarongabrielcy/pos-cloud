import { InstallationCredential } from "./installation-credential";
import { InstallationCredentialId } from "./installation-credential-id";
import { FixedClock } from "../test-support/fixed-clock";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

describe("InstallationCredential", () => {
  it("issues with revokedAt null", () => {
    const clock = new FixedClock(BASE_TIME);

    const credential = InstallationCredential.issue(
      { id: "credential-1", installationId: "installation-1", secretHash: "a".repeat(64) },
      clock,
    );

    expect(credential.isRevoked()).toBe(false);
    expect(credential.revokedAt).toBeNull();
    expect(credential.createdAt).toEqual(BASE_TIME);
  });

  it("revoke sets revokedAt", () => {
    const clock = new FixedClock(BASE_TIME);
    const credential = InstallationCredential.issue(
      { id: "credential-1", installationId: "installation-1", secretHash: "a".repeat(64) },
      clock,
    );

    credential.revoke(clock);

    expect(credential.isRevoked()).toBe(true);
    expect(credential.revokedAt).toEqual(BASE_TIME);
  });

  it("revoke is idempotent - a second revoke does not change the original revokedAt", () => {
    const clock = new FixedClock(BASE_TIME);
    const credential = InstallationCredential.issue(
      { id: "credential-1", installationId: "installation-1", secretHash: "a".repeat(64) },
      clock,
    );

    credential.revoke(clock);
    const firstRevokedAt = credential.revokedAt;

    const laterClock = new FixedClock(new Date(BASE_TIME.getTime() + 60_000));
    credential.revoke(laterClock);

    expect(credential.revokedAt).toEqual(firstRevokedAt);
  });

  it("reconstitute rehydrates without re-validating", () => {
    const rehydrated = InstallationCredential.reconstitute({
      id: InstallationCredentialId.of("credential-1"),
      installationId: "installation-1",
      secretHash: "b".repeat(64),
      createdAt: BASE_TIME,
      revokedAt: null,
    });

    expect(rehydrated.isRevoked()).toBe(false);
  });
});
