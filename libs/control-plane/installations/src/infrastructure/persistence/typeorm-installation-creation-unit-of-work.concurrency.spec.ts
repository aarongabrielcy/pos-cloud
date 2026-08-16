import { randomUUID } from "node:crypto";
import "reflect-metadata";
import { SystemClock } from "@pos-cloud/shared-kernel";
import { DataSource } from "typeorm";
import { Installation } from "../../domain/installation";
import { LicenseCapacityExceededError } from "../../domain/installation.errors";
import { Platform } from "../../domain/platform";
import { InstallationRecord } from "./installation.record";
import { TypeOrmInstallationCreationUnitOfWork } from "./typeorm-installation-creation-unit-of-work";

/**
 * A REAL concurrency test - not a sequential unit test (backend backlog: "maxInstallations
 * concurrent-create race"). typeorm-installation-creation-unit-of-work.spec.ts already proves, with
 * a mocked DataSource, that the lock SQL is issued first and with the right params; that alone
 * cannot prove `pg_advisory_xact_lock` actually blocks a second concurrent transaction, since a mock
 * has no real notion of blocking. Only a real PostgreSQL connection can prove that, so this suite
 * fires two genuinely concurrent `runExclusiveForLicense` calls (via `Promise.allSettled`, never
 * awaited one after another) against the real local Postgres and asserts exactly one succeeds.
 *
 * Gated on `POSTGRES_HOST` being set, mirroring typeorm-installation.repository.spec.ts's own
 * established real-DB test pattern in this same package - `pnpm test` stays fully offline/portable
 * everywhere this isn't set. Unlike that file's per-test rolled-back QueryRunner (a single
 * connection, used for isolation), this suite needs the DataSource's real connection POOL so the two
 * concurrent attempts genuinely race across independent connections - each inserted row is deleted
 * explicitly in `finally` instead.
 *
 * To run for real (e.g. against the local `pos-cloud-postgres` Docker container):
 *   POSTGRES_HOST=localhost POSTGRES_PORT=5433 POSTGRES_USER=poscloud \
 *   POSTGRES_PASSWORD=<see infra/../config/pos-cloud/infrastructure.env> POSTGRES_DB=posplatform_cloud \
 *   pnpm --filter @pos-cloud/installations test -- typeorm-installation-creation-unit-of-work.concurrency
 */
const realDbAvailable = Boolean(process.env.POSTGRES_HOST);
const describeWithRealDb = realDbAvailable ? describe : describe.skip;

describeWithRealDb("TypeOrmInstallationCreationUnitOfWork - real concurrency", () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [InstallationRecord],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  function buildInstallation(licenseId: string, installationCode: string): Installation {
    return Installation.create(
      {
        id: randomUUID(),
        customerId: randomUUID(),
        licenseId,
        installationCode,
        name: "Concurrency Fixture",
        platform: Platform.WINDOWS,
      },
      new SystemClock(),
    );
  }

  it("allows exactly one of two truly concurrent creates to succeed when maxInstallations=1", async () => {
    const licenseId = randomUUID();
    const maxInstallations = 1;
    const unitOfWork = new TypeOrmInstallationCreationUnitOfWork(dataSource);

    async function attemptCreate(installationCode: string) {
      return unitOfWork.runExclusiveForLicense(licenseId, async (ctx) => {
        const current = await ctx.countNonDecommissionedByLicense(licenseId);
        if (current >= maxInstallations) {
          throw new LicenseCapacityExceededError(licenseId, maxInstallations);
        }
        const installation = buildInstallation(licenseId, installationCode);
        await ctx.saveInstallation(installation);
        return installation;
      });
    }

    try {
      // Fired together, not awaited one after another - genuine concurrency, not a sequential
      // "call A, then call B" simulation.
      const results = await Promise.allSettled([
        attemptCreate("POS-CONC-A"),
        attemptCreate("POS-CONC-B"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        LicenseCapacityExceededError,
      );

      const finalCount = await dataSource
        .getRepository(InstallationRecord)
        .count({ where: { licenseId } });
      expect(finalCount).toBe(1);
    } finally {
      // Real commits (unlike typeorm-installation.repository.spec.ts's rolled-back QueryRunner) -
      // clean up explicitly so the shared local dev database is left exactly as it was found.
      await dataSource.query(`DELETE FROM installations.installations WHERE license_id = $1`, [
        licenseId,
      ]);
    }
  }, 20_000);
});
