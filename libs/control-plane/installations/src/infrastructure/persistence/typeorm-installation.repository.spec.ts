import { randomUUID } from "node:crypto";
import "reflect-metadata";
import { DataSource, type QueryRunner, type Repository } from "typeorm";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { InstallationHealthRecord } from "./installation-health.record";
import { InstallationRecord } from "./installation.record";
import { TypeOrmInstallationRepository } from "./typeorm-installation.repository";

/**
 * `list()` has no other unit coverage anywhere in this repository - the pre-fix bug (TypeError:
 * Cannot read properties of undefined (reading 'databaseName'), see ADR-015 / CLOUD-01C-D correction
 * report) only ever manifested against TypeORM's *real* query-builder + entity metadata, exercised by
 * `.skip()/.take()` combined with a `.leftJoin()`. A mocked `Repository`/`QueryBuilder` (this repo's
 * usual test style - see e.g. typeorm-admin-role.repository.spec.ts) cannot reproduce that class of
 * bug at all, since the mock never runs TypeORM's actual SQL-generation code.
 *
 * This suite runs against a real TypeORM `DataSource` connected to Postgres, gated on `POSTGRES_HOST`
 * being set so `pnpm test` stays fully offline/portable everywhere else (this repo deliberately has no
 * other real-DB test harness - see docs/architecture/installation-health.md#test-plan). Every test runs
 * inside a transaction that is always rolled back in `afterEach`, so nothing is ever persisted.
 *
 * To run for real (e.g. against the local `pos-cloud-postgres` Docker container):
 *   POSTGRES_HOST=localhost POSTGRES_PORT=5433 POSTGRES_USER=poscloud \
 *   POSTGRES_PASSWORD=<see infra/.env> POSTGRES_DB=posplatform_cloud \
 *   pnpm --filter @pos-cloud/installations test -- typeorm-installation.repository
 */
const realDbAvailable = Boolean(process.env.POSTGRES_HOST);
const describeWithRealDb = realDbAvailable ? describe : describe.skip;

describeWithRealDb("TypeOrmInstallationRepository.list() - real TypeORM metadata", () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let installationRepo: Repository<InstallationRecord>;
  let healthRepo: Repository<InstallationHealthRecord>;
  let repository: TypeOrmInstallationRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [InstallationRecord, InstallationHealthRecord],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    installationRepo = queryRunner.manager.getRepository(InstallationRecord);
    healthRepo = queryRunner.manager.getRepository(InstallationHealthRecord);
    repository = new TypeOrmInstallationRepository(installationRepo);
  });

  afterEach(async () => {
    // Always rolled back - this suite never persists anything, regardless of test outcome.
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  function buildInstallation(overrides: {
    customerId: string;
    licenseId: string;
    installationCode: string;
    status?: InstallationStatus;
    createdAt: Date;
  }): Installation {
    return Installation.reconstitute({
      id: InstallationId.of(randomUUID()),
      customerId: overrides.customerId,
      licenseId: overrides.licenseId,
      installationCode: InstallationCode.create(overrides.installationCode),
      name: "Regression Fixture",
      platform: Platform.WINDOWS,
      status: overrides.status ?? InstallationStatus.ACTIVE,
      registeredAt: overrides.createdAt,
      createdAt: overrides.createdAt,
      updatedAt: overrides.createdAt,
    });
  }

  it("does not throw and returns 1 query for the page when paginated (the exact crash this fixes)", async () => {
    const customerId = randomUUID();
    const licenseId = randomUUID();
    const installation = buildInstallation({
      customerId,
      licenseId,
      installationCode: "UT-LIST-001",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repository.save(installation);

    const querySpy = jest.spyOn(queryRunner, "query");

    const result = await repository.list({ page: 1, pageSize: 10, customerId });

    expect(result.items).toHaveLength(1);
    // Exactly 2 SELECTs total: the count (always separate - unrelated to this fix) and ONE page-fetch
    // that carries entities + the subquery-selected health column together. A `.leftJoin()`-based
    // design instead silently issues 3 queries once its orderBy no longer crashes (count + an
    // ids-in-page subquery + a separate hydrate-by-ids query - TypeORM's paginated-join branch, the
    // same branch whose orderBy resolution crashed before this fix); the subquery-based fix never
    // enters that branch at all, so the page-fetch itself is genuinely one query, not N+1 and not 2.
    const selectCalls = querySpy.mock.calls.filter(([sql]) => /^\s*SELECT/i.test(String(sql)));
    expect(selectCalls).toHaveLength(2);
  });

  it("returns lastSeenAt from installation_health when a health row exists", async () => {
    const customerId = randomUUID();
    const licenseId = randomUUID();
    const installation = buildInstallation({
      customerId,
      licenseId,
      installationCode: "UT-LIST-002",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repository.save(installation);
    const lastSeenAt = new Date("2026-01-02T00:00:00.000Z");
    await healthRepo.save({
      installationId: installation.id.toString(),
      firstSeenAt: lastSeenAt,
      lastSeenAt,
      clientReportedAt: null,
      appVersion: "1.0.0",
    });

    const result = await repository.list({ page: 1, pageSize: 10, customerId });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lastSeenAt?.toISOString()).toBe(lastSeenAt.toISOString());
  });

  it("returns lastSeenAt = null when no health row exists (NEVER_SEEN is computed by the application layer)", async () => {
    const customerId = randomUUID();
    const licenseId = randomUUID();
    const installation = buildInstallation({
      customerId,
      licenseId,
      installationCode: "UT-LIST-003",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repository.save(installation);

    const result = await repository.list({ page: 1, pageSize: 10, customerId });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lastSeenAt).toBeNull();
  });

  it("paginates correctly across pages", async () => {
    const customerId = randomUUID();
    const licenseId = randomUUID();
    for (let i = 0; i < 3; i += 1) {
      await repository.save(
        buildInstallation({
          customerId,
          licenseId,
          installationCode: `UT-LIST-PAGE-${i}`,
          createdAt: new Date(2026, 0, i + 1),
        }),
      );
    }

    const page1 = await repository.list({ page: 1, pageSize: 2, customerId });
    const page2 = await repository.list({ page: 2, pageSize: 2, customerId });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);
    expect(page2.items).toHaveLength(1);
  });

  it("orders by createdAt DESC", async () => {
    const customerId = randomUUID();
    const licenseId = randomUUID();
    const older = buildInstallation({
      customerId,
      licenseId,
      installationCode: "UT-LIST-ORDER-OLD",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = buildInstallation({
      customerId,
      licenseId,
      installationCode: "UT-LIST-ORDER-NEW",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    await repository.save(older);
    await repository.save(newer);

    const result = await repository.list({ page: 1, pageSize: 10, customerId });

    expect(result.items.map((item) => item.installation.installationCode.toString())).toEqual([
      "UT-LIST-ORDER-NEW",
      "UT-LIST-ORDER-OLD",
    ]);
  });
});
