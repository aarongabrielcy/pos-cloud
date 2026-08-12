import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationCredential } from "../../domain/installation-credential";
import type { InstallationEnrollment } from "../../domain/installation-enrollment";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { EnrollmentFailedError } from "../../domain/installation.errors";
import { Platform } from "../../domain/platform";
import { FakeInstallationSecretGenerator } from "../../test-support/fake-installation-secret-generator";
import { FakeCustomerReader, FakeLicenseReader } from "../../test-support/fake-readers";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationEnrollmentConsumptionUnitOfWork } from "../../test-support/in-memory-installation-enrollment-consumption-unit-of-work";
import { InMemoryInstallationEnrollmentRepository } from "../../test-support/in-memory-installation-enrollment-repository";
import { EnrollInstallationUseCase } from "./enroll-installation.use-case";
import { IssueInstallationEnrollmentUseCase } from "./issue-installation-enrollment.use-case";
import { InMemoryInstallationEnrollmentIssuanceUnitOfWork } from "../../test-support/in-memory-installation-enrollment-issuance-unit-of-work";
import type { InstallationAuthConfig } from "@pos-cloud/config";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

function buildInstallation(
  status: InstallationStatus,
  overrides: { customerId: string; licenseId: string },
): Installation {
  return Installation.reconstitute({
    id: InstallationId.of(randomUUID()),
    customerId: overrides.customerId,
    licenseId: overrides.licenseId,
    installationCode: InstallationCode.create("POS-GST-00001"),
    name: "Sucursal Principal",
    platform: Platform.WINDOWS,
    status,
    registeredAt: status === InstallationStatus.PENDING ? null : BASE_TIME,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

function setup() {
  const installations = new Map<string, Installation>();
  const enrollments = new Map<string, InstallationEnrollment>();
  const credentials = new Map<string, InstallationCredential>();

  const issuanceUnitOfWork = new InMemoryInstallationEnrollmentIssuanceUnitOfWork(
    installations,
    enrollments,
  );
  const consumptionUnitOfWork = new InMemoryInstallationEnrollmentConsumptionUnitOfWork(
    installations,
    enrollments,
    credentials,
  );
  const enrollmentRepository = new InMemoryInstallationEnrollmentRepository(enrollments);
  const secretGenerator = new FakeInstallationSecretGenerator();
  const customerReader = new FakeCustomerReader();
  const licenseReader = new FakeLicenseReader();
  const clock = new FixedClock(BASE_TIME);
  const idGenerator = new RandomUuidGenerator();
  const installationAuthConfig: InstallationAuthConfig = { enrollmentCodeTtlSeconds: 900 };

  const issueUseCase = new IssueInstallationEnrollmentUseCase(
    issuanceUnitOfWork,
    secretGenerator,
    clock,
    idGenerator,
    installationAuthConfig,
  );
  const enrollUseCase = new EnrollInstallationUseCase(
    enrollmentRepository,
    consumptionUnitOfWork,
    secretGenerator,
    customerReader,
    licenseReader,
    clock,
    idGenerator,
  );

  /** Builds a second EnrollInstallationUseCase sharing every dependency except the clock - used to simulate time passing between issuance and consumption without reaching into private entity state. */
  function buildEnrollUseCaseAt(at: Date): EnrollInstallationUseCase {
    return new EnrollInstallationUseCase(
      enrollmentRepository,
      consumptionUnitOfWork,
      secretGenerator,
      customerReader,
      licenseReader,
      new FixedClock(at),
      idGenerator,
    );
  }

  return {
    installations,
    enrollments,
    credentials,
    issueUseCase,
    enrollUseCase,
    buildEnrollUseCaseAt,
    customerReader,
    licenseReader,
    clock,
  };
}

async function seedEligibleInstallation(
  ctx: ReturnType<typeof setup>,
  status: InstallationStatus,
  purpose: InstallationEnrollmentPurpose,
) {
  const customerId = randomUUID();
  const licenseId = randomUUID();
  ctx.customerReader.register({ id: customerId, active: true });
  ctx.licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });

  const installation = buildInstallation(status, { customerId, licenseId });
  ctx.installations.set(installation.id.toString(), installation);

  const { enrollmentCode } = await ctx.issueUseCase.execute({
    installationId: installation.id.toString(),
    purpose,
  });

  return { installation, enrollmentCode, customerId, licenseId };
}

describe("EnrollInstallationUseCase", () => {
  it("fails on a malformed enrollment code (no separator)", async () => {
    const ctx = setup();

    await expect(ctx.enrollUseCase.execute({ enrollmentCode: "not-a-valid-code" })).rejects.toThrow(
      EnrollmentFailedError,
    );
  });

  it("fails on an unknown enrollment id", async () => {
    const ctx = setup();

    await expect(
      ctx.enrollUseCase.execute({ enrollmentCode: `${randomUUID()}.some-secret` }),
    ).rejects.toThrow(EnrollmentFailedError);
  });

  it("fails on the wrong secret", async () => {
    const ctx = setup();
    const { installation } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );
    const [enrollmentId] = [...ctx.enrollments.keys()];

    await expect(
      ctx.enrollUseCase.execute({ enrollmentCode: `${enrollmentId}.wrong-secret` }),
    ).rejects.toThrow(EnrollmentFailedError);
    expect(installation.status).toBe(InstallationStatus.PENDING);
  });

  it("fails once expired", async () => {
    const ctx = setup();
    const { enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );
    // Enrollment was issued with the default 900s TTL against BASE_TIME - consume 900s + 1ms later.
    const afterExpiry = ctx.buildEnrollUseCaseAt(new Date(BASE_TIME.getTime() + 900_001));

    await expect(afterExpiry.execute({ enrollmentCode })).rejects.toThrow(EnrollmentFailedError);
  });

  it("fails on replay - a second consume attempt with an already-consumed code is rejected", async () => {
    const ctx = setup();
    const { enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );

    await expect(ctx.enrollUseCase.execute({ enrollmentCode })).resolves.toBeDefined();
    await expect(ctx.enrollUseCase.execute({ enrollmentCode })).rejects.toThrow(
      EnrollmentFailedError,
    );
  });

  it("fails on a revoked code", async () => {
    const ctx = setup();
    const { enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );
    const [enrollment] = [...ctx.enrollments.values()];
    enrollment.revoke(ctx.clock);

    await expect(ctx.enrollUseCase.execute({ enrollmentCode })).rejects.toThrow(
      EnrollmentFailedError,
    );
  });

  it("fails when the Customer is not ACTIVE (fresh check)", async () => {
    const ctx = setup();
    const { enrollmentCode, customerId } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );
    ctx.customerReader.register({ id: customerId, active: false });

    await expect(ctx.enrollUseCase.execute({ enrollmentCode })).rejects.toThrow(
      EnrollmentFailedError,
    );
  });

  it("fails when the License is not usable (fresh check)", async () => {
    const ctx = setup();
    const { enrollmentCode, customerId, licenseId } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );
    ctx.licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: false });

    await expect(ctx.enrollUseCase.execute({ enrollmentCode })).rejects.toThrow(
      EnrollmentFailedError,
    );
  });

  it("INITIAL + PENDING succeeds: activates the Installation and issues a credential", async () => {
    const ctx = setup();
    const { installation, enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );

    const result = await ctx.enrollUseCase.execute({ enrollmentCode });

    expect(result.installationId).toBe(installation.id.toString());
    expect(result.credential).toContain(".");
    const stored = ctx.installations.get(installation.id.toString());
    expect(stored?.status).toBe(InstallationStatus.ACTIVE);
    expect(stored?.registeredAt).not.toBeNull();
    expect(ctx.credentials.size).toBe(1);
  });

  it("RECOVERY + ACTIVE succeeds: stays ACTIVE, issues a new credential, revokes the prior one", async () => {
    const ctx = setup();
    const { installation, enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.ACTIVE,
      InstallationEnrollmentPurpose.RECOVERY,
    );

    // Seed a pre-existing active credential to prove RECOVERY revokes it.
    const priorCredential = InstallationCredential.issue(
      { id: randomUUID(), installationId: installation.id.toString(), secretHash: "a".repeat(64) },
      ctx.clock,
    );
    ctx.credentials.set(priorCredential.id.toString(), priorCredential);

    const result = await ctx.enrollUseCase.execute({ enrollmentCode });

    expect(result.installationId).toBe(installation.id.toString());
    const stored = ctx.installations.get(installation.id.toString());
    expect(stored?.status).toBe(InstallationStatus.ACTIVE);
    expect(priorCredential.isRevoked()).toBe(true);

    const activeCredentials = [...ctx.credentials.values()].filter((c) => !c.isRevoked());
    expect(activeCredentials).toHaveLength(1);
  });

  it("RECOVERY + SUSPENDED succeeds: credential issued but Installation stays SUSPENDED", async () => {
    const ctx = setup();
    const { installation, enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.SUSPENDED,
      InstallationEnrollmentPurpose.RECOVERY,
    );

    await ctx.enrollUseCase.execute({ enrollmentCode });

    const stored = ctx.installations.get(installation.id.toString());
    expect(stored?.status).toBe(InstallationStatus.SUSPENDED);
    expect(ctx.credentials.size).toBe(1);
  });

  it("rejects consuming an INITIAL code whose Installation status changed to non-eligible since issuance", async () => {
    const ctx = setup();
    const { installation, enrollmentCode } = await seedEligibleInstallation(
      ctx,
      InstallationStatus.PENDING,
      InstallationEnrollmentPurpose.INITIAL,
    );
    // Simulate the Installation being decommissioned after the code was issued but before consumption.
    installation.changeStatus(InstallationStatus.DECOMMISSIONED, ctx.clock);
    ctx.installations.set(installation.id.toString(), installation);

    await expect(ctx.enrollUseCase.execute({ enrollmentCode })).rejects.toThrow(
      EnrollmentFailedError,
    );
  });
});
