import { randomUUID } from "node:crypto";
import { InstallationCredential } from "../../domain/installation-credential";
import { FixedClock } from "../../test-support/fixed-clock";
import { InstallationCredentialMapper } from "./installation-credential.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("InstallationCredentialMapper", () => {
  it("round-trips an InstallationCredential through toRecord/toDomain", () => {
    const original = InstallationCredential.issue(
      { id: randomUUID(), installationId: randomUUID(), secretHash: "a".repeat(64) },
      clock,
    );

    const rehydrated = InstallationCredentialMapper.toDomain(
      InstallationCredentialMapper.toRecord(original),
    );

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.installationId).toBe(original.installationId);
    expect(rehydrated.secretHash).toBe(original.secretHash);
    expect(rehydrated.revokedAt).toBeNull();
  });

  it("preserves revokedAt after revocation", () => {
    const original = InstallationCredential.issue(
      { id: randomUUID(), installationId: randomUUID(), secretHash: "a".repeat(64) },
      clock,
    );
    original.revoke(clock);

    const rehydrated = InstallationCredentialMapper.toDomain(
      InstallationCredentialMapper.toRecord(original),
    );

    expect(rehydrated.revokedAt).toEqual(clock.now());
  });
});
