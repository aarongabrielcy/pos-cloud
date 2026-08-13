import { randomUUID } from "node:crypto";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationCredential } from "../../domain/installation-credential";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { InstallationNotFoundError } from "../../domain/installation.errors";
import { Platform } from "../../domain/platform";
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationCredentialRepository } from "../../test-support/in-memory-installation-credential-repository";
import { InMemoryInstallationRepository } from "../../test-support/in-memory-installation-repository";
import { RevokeInstallationCredentialUseCase } from "./revoke-installation-credential.use-case";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

function buildInstallation(): Installation {
  return Installation.reconstitute({
    id: InstallationId.of(randomUUID()),
    customerId: randomUUID(),
    licenseId: randomUUID(),
    installationCode: InstallationCode.create("POS-GST-00001"),
    name: "Sucursal Principal",
    platform: Platform.WINDOWS,
    status: InstallationStatus.ACTIVE,
    registeredAt: BASE_TIME,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

function setup() {
  const installations = new InMemoryInstallationRepository();
  const credentials = new Map<string, InstallationCredential>();
  const credentialRepository = new InMemoryInstallationCredentialRepository(credentials);
  const clock = new FixedClock(BASE_TIME);
  const auditRecorder = new FakeAuditRecorder();
  const useCase = new RevokeInstallationCredentialUseCase(
    installations,
    credentialRepository,
    clock,
    auditRecorder,
  );
  return { installations, credentials, credentialRepository, useCase, clock, auditRecorder };
}

describe("RevokeInstallationCredentialUseCase", () => {
  it("fails when the installation does not exist", async () => {
    const { useCase } = setup();

    await expect(useCase.execute({ installationId: randomUUID() }, ACTOR)).rejects.toThrow(
      InstallationNotFoundError,
    );
  });

  it("is idempotent - succeeds even when there is no active credential", async () => {
    const { installations, useCase } = setup();
    const installation = buildInstallation();
    await installations.save(installation);

    await expect(
      useCase.execute({ installationId: installation.id.toString() }, ACTOR),
    ).resolves.toBeUndefined();
  });

  it("does not record an audit event for the idempotent no-op branch", async () => {
    const { installations, useCase, auditRecorder } = setup();
    const installation = buildInstallation();
    await installations.save(installation);

    await useCase.execute({ installationId: installation.id.toString() }, ACTOR);

    expect(auditRecorder.recorded).toHaveLength(0);
  });

  it("revokes the active credential", async () => {
    const { installations, credentials, useCase } = setup();
    const installation = buildInstallation();
    await installations.save(installation);
    const credential = InstallationCredential.issue(
      { id: randomUUID(), installationId: installation.id.toString(), secretHash: "a".repeat(64) },
      new FixedClock(BASE_TIME),
    );
    credentials.set(credential.id.toString(), credential);

    await useCase.execute({ installationId: installation.id.toString() }, ACTOR);

    expect(credential.isRevoked()).toBe(true);
  });

  it("records an audit event when a credential was actually revoked", async () => {
    const { installations, credentials, useCase, auditRecorder } = setup();
    const installation = buildInstallation();
    await installations.save(installation);
    const credential = InstallationCredential.issue(
      { id: randomUUID(), installationId: installation.id.toString(), secretHash: "a".repeat(64) },
      new FixedClock(BASE_TIME),
    );
    credentials.set(credential.id.toString(), credential);

    await useCase.execute({ installationId: installation.id.toString() }, ACTOR);

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: INSTALLATION_AUDIT_ACTIONS.CREDENTIAL_REVOKED,
        resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
        resourceId: installation.id.toString(),
        metadata: {},
      },
    ]);
  });

  it("never changes Installation.status", async () => {
    const { installations, credentials, useCase } = setup();
    const installation = buildInstallation();
    await installations.save(installation);
    const credential = InstallationCredential.issue(
      { id: randomUUID(), installationId: installation.id.toString(), secretHash: "a".repeat(64) },
      new FixedClock(BASE_TIME),
    );
    credentials.set(credential.id.toString(), credential);

    await useCase.execute({ installationId: installation.id.toString() }, ACTOR);

    const stored = await installations.findById(installation.id);
    expect(stored?.status).toBe(InstallationStatus.ACTIVE);
  });

  it("revoking twice is safe (idempotent)", async () => {
    const { installations, credentials, useCase } = setup();
    const installation = buildInstallation();
    await installations.save(installation);
    const credential = InstallationCredential.issue(
      { id: randomUUID(), installationId: installation.id.toString(), secretHash: "a".repeat(64) },
      new FixedClock(BASE_TIME),
    );
    credentials.set(credential.id.toString(), credential);

    await useCase.execute({ installationId: installation.id.toString() }, ACTOR);
    await expect(
      useCase.execute({ installationId: installation.id.toString() }, ACTOR),
    ).resolves.toBeUndefined();
  });
});
