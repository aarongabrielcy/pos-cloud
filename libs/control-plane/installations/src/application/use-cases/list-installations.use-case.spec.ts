import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader, FakeLicenseReader } from "../../test-support/fake-readers";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationRepository } from "../../test-support/in-memory-installation-repository";
import { Platform } from "../../domain/platform";
import { CreateInstallationUseCase } from "./create-installation.use-case";
import { ListInstallationsUseCase } from "./list-installations.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

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
      repository,
      customerReader,
      licenseReader,
      clock,
      new RandomUuidGenerator(),
    );
    await createUseCase.execute({
      customerId,
      licenseId,
      installationCode: "POS-GST-00001",
      name: "Sucursal Windows",
      platform: Platform.WINDOWS,
    });
    await createUseCase.execute({
      customerId,
      licenseId,
      installationCode: "POS-GST-00002",
      name: "Tablet Android",
      platform: Platform.ANDROID,
    });

    const result = await new ListInstallationsUseCase(repository).execute({
      platform: Platform.ANDROID,
    });

    expect(result).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    expect(result.items[0]?.platform).toBe(Platform.ANDROID);
  });
});
