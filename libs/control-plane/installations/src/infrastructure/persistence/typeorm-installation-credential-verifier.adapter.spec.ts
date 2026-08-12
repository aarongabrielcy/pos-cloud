import type { DataSource } from "typeorm";
import { InstallationStatus } from "../../domain/installation-status";
import { CryptoInstallationSecretGenerator } from "../security/crypto-installation-secret-generator.adapter";
import { TypeOrmInstallationCredentialVerifierAdapter } from "./typeorm-installation-credential-verifier.adapter";

const secretGenerator = new CryptoInstallationSecretGenerator();

const VALID_CREDENTIAL_ID = "11111111-1111-4111-8111-111111111111";
const UNKNOWN_BUT_WELL_FORMED_ID = "22222222-2222-4222-8222-222222222222";

function buildAdapter(rows: Array<Record<string, unknown>>) {
  const query = jest.fn().mockResolvedValue(rows);
  const dataSource = { query } as unknown as DataSource;
  const adapter = new TypeOrmInstallationCredentialVerifierAdapter(dataSource, secretGenerator);
  return { adapter, query };
}

describe("TypeOrmInstallationCredentialVerifierAdapter", () => {
  it("returns null when the credential id is well-formed but unknown (no row)", async () => {
    const { adapter, query } = buildAdapter([]);

    const result = await adapter.verify(UNKNOWN_BUT_WELL_FORMED_ID, "any-secret");

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("installation_credentials"), [
      UNKNOWN_BUT_WELL_FORMED_ID,
    ]);
  });

  it("returns null when the credential is revoked, even with the correct secret", async () => {
    const { adapter } = buildAdapter([
      {
        secret_hash: secretGenerator.hashSecret("correct-secret"),
        credential_revoked_at: new Date("2026-01-01T00:00:00.000Z"),
        installation_id: "installation-1",
        installation_status: InstallationStatus.ACTIVE,
      },
    ]);

    const result = await adapter.verify(VALID_CREDENTIAL_ID, "correct-secret");

    expect(result).toBeNull();
  });

  it("returns null on a wrong secret", async () => {
    const { adapter } = buildAdapter([
      {
        secret_hash: secretGenerator.hashSecret("correct-secret"),
        credential_revoked_at: null,
        installation_id: "installation-1",
        installation_status: InstallationStatus.ACTIVE,
      },
    ]);

    const result = await adapter.verify(VALID_CREDENTIAL_ID, "wrong-secret");

    expect(result).toBeNull();
  });

  it("returns installationId + live status for a valid, non-revoked credential", async () => {
    const { adapter } = buildAdapter([
      {
        secret_hash: secretGenerator.hashSecret("correct-secret"),
        credential_revoked_at: null,
        installation_id: "installation-1",
        installation_status: InstallationStatus.SUSPENDED,
      },
    ]);

    const result = await adapter.verify(VALID_CREDENTIAL_ID, "correct-secret");

    expect(result).toEqual({
      installationId: "installation-1",
      installationStatus: InstallationStatus.SUSPENDED,
    });
  });

  describe("malformed credential id (regression: CLOUD-01C-C runtime validation)", () => {
    it("returns null without querying when the id is not UUID-shaped at all", async () => {
      const { adapter, query } = buildAdapter([]);

      const result = await adapter.verify("abc.def", "def");

      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it("returns null without querying when the id looks like a JWT header segment", async () => {
      const { adapter, query } = buildAdapter([]);
      const jwtHeaderSegment = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";

      const result = await adapter.verify(jwtHeaderSegment, "payload.signature");

      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it("never lets a malformed id reach the database - a well-formed UUID always does", async () => {
      const { adapter, query } = buildAdapter([]);

      await adapter.verify("not-a-uuid", "secret");
      expect(query).not.toHaveBeenCalled();

      await adapter.verify(UNKNOWN_BUT_WELL_FORMED_ID, "secret");
      expect(query).toHaveBeenCalledTimes(1);
    });
  });
});
