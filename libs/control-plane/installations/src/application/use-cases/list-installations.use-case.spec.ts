import { randomUUID } from "node:crypto";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FakeCustomerReader, FakeLicenseReader } from "../../test-support/fake-readers";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationCreationUnitOfWork } from "../../test-support/in-memory-installation-creation-unit-of-work";
import { InMemoryInstallationRepository } from "../../test-support/in-memory-installation-repository";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationHealthStatus } from "../../domain/installation-health-status";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { CreateInstallationUseCase } from "./create-installation.use-case";
import { ListInstallationsUseCase } from "./list-installations.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:10:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};
const HEALTH_CONFIG = {
  heartbeatIntervalSeconds: 60,
  staleAfterSeconds: 120,
  offlineAfterSeconds: 300,
};

describe("ListInstallationsUseCase", () => {
  it("honors the pagination contract and filters by platform", async () => {
    const repository = new InMemoryInstallationRepository();
    const customerReader = new FakeCustomerReader();
    const licenseReader = new FakeLicenseReader();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });
    const createUseCase = new CreateInstallationUseCase(
      customerReader,
      licenseReader,
      new InMemoryInstallationCreationUnitOfWork(repository),
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    );
    await createUseCase.execute(
      {
        customerId,
        licenseId,
        installationCode: "POS-GST-00001",
        name: "Sucursal Windows",
        platform: Platform.WINDOWS,
      },
      ACTOR,
    );
    await createUseCase.execute(
      {
        customerId,
        licenseId,
        installationCode: "POS-GST-00002",
        name: "Tablet Android",
        platform: Platform.ANDROID,
      },
      ACTOR,
    );

    const result = await new ListInstallationsUseCase(repository, HEALTH_CONFIG, clock).execute({
      platform: Platform.ANDROID,
    });

    expect(result).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    expect(result.items[0]?.installation.platform).toBe(Platform.ANDROID);
  });

  it("reports NEVER_SEEN for a PENDING installation with no heartbeat", async () => {
    const repository = new InMemoryInstallationRepository();
    const customerReader = new FakeCustomerReader();
    const licenseReader = new FakeLicenseReader();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });
    const createUseCase = new CreateInstallationUseCase(
      customerReader,
      licenseReader,
      new InMemoryInstallationCreationUnitOfWork(repository),
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    );
    await createUseCase.execute(
      {
        customerId,
        licenseId,
        installationCode: "POS-GST-00001",
        name: "Sucursal Windows",
        platform: Platform.WINDOWS,
      },
      ACTOR,
    );

    const result = await new ListInstallationsUseCase(repository, HEALTH_CONFIG, clock).execute({});

    expect(result.items[0]?.healthStatus).toBe(InstallationHealthStatus.NEVER_SEEN);
    expect(result.items[0]?.lastSeenAt).toBeNull();
  });

  it("reports ONLINE for an ACTIVE installation with a recent heartbeat, using the single joined lastSeenAt (no N+1)", async () => {
    const repository = new InMemoryInstallationRepository();
    const installation = Installation.reconstitute({
      id: InstallationId.of(randomUUID()),
      customerId: randomUUID(),
      licenseId: randomUUID(),
      installationCode: InstallationCode.create("POS-GST-00001"),
      name: "Sucursal Windows",
      platform: Platform.WINDOWS,
      status: InstallationStatus.ACTIVE,
      registeredAt: clock.now(),
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
    await repository.save(installation);
    repository.setLastSeenAt(installation.id.toString(), new Date(clock.now().getTime() - 5_000));

    const result = await new ListInstallationsUseCase(repository, HEALTH_CONFIG, clock).execute({});

    expect(result.items[0]?.healthStatus).toBe(InstallationHealthStatus.ONLINE);
  });
});
