import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { isUUID } from "class-validator";
import type { DataSource } from "typeorm";
import type {
  InstallationCredentialVerificationResult,
  InstallationCredentialVerifierPort,
} from "../../application/ports/installation-credential-verifier.port";
import {
  INSTALLATION_SECRET_GENERATOR,
  type InstallationSecretGeneratorPort,
} from "../../application/ports/installation-secret-generator.port";
import type { InstallationStatus } from "../../domain/installation-status";

interface CredentialJoinRow {
  secret_hash: string;
  credential_revoked_at: Date | null;
  installation_id: string;
  installation_status: string;
}

/**
 * Single indexed round-trip: joins installation_credentials -> installations by installation_id,
 * filtered by credential id - the direct structural twin of TypeOrmPermissionResolverAdapter (one
 * query, no N+1, no Redis). Uses a raw parameterized query (not the entity/repository API) for the
 * same reason that adapter does: this reads across two tables at once purely for this one join shape.
 */
@Injectable()
export class TypeOrmInstallationCredentialVerifierAdapter implements InstallationCredentialVerifierPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(INSTALLATION_SECRET_GENERATOR)
    private readonly secretGenerator: InstallationSecretGeneratorPort,
  ) {}

  async verify(
    credentialId: string,
    secret: string,
  ): Promise<InstallationCredentialVerificationResult | null> {
    // `credentialId` comes straight from a client-controlled Bearer value (see opaque-token-format.ts)
    // and `ic.id` is a `uuid` column - a non-UUID value here would make PostgreSQL throw a
    // QueryFailedError (22P02) instead of the intended "no match", so this is rejected as an
    // ordinary invalid-credential outcome before ever reaching the database.
    if (!isUUID(credentialId)) {
      return null;
    }

    const rows: CredentialJoinRow[] = await this.dataSource.query(
      `
        SELECT ic.secret_hash, ic.revoked_at AS credential_revoked_at,
               i.id AS installation_id, i.status AS installation_status
        FROM installations.installation_credentials ic
        JOIN installations.installations i ON i.id = ic.installation_id
        WHERE ic.id = $1
      `,
      [credentialId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }
    if (row.credential_revoked_at !== null) {
      return null;
    }
    if (!this.secretGenerator.secretMatchesHash(secret, row.secret_hash)) {
      return null;
    }

    return {
      installationId: row.installation_id,
      installationStatus: row.installation_status as InstallationStatus,
    };
  }
}
