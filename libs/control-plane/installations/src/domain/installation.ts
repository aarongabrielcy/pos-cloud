import type { Clock } from "@pos-cloud/shared-kernel";
import { InstallationCode } from "./installation-code";
import { InstallationId } from "./installation-id";
import { isInstallationAdminTransitionAllowed, InstallationStatus } from "./installation-status";
import {
  InvalidInstallationNameError,
  InvalidInstallationStatusTransitionError,
} from "./installation.errors";
import type { Platform } from "./platform";

export interface InstallationProps {
  id: InstallationId;
  customerId: string;
  licenseId: string;
  installationCode: InstallationCode;
  name: string;
  platform: Platform;
  status: InstallationStatus;
  registeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstallationInput {
  id: string;
  customerId: string;
  licenseId: string;
  installationCode: string;
  name: string;
  platform: Platform;
}

export class Installation {
  private constructor(private props: InstallationProps) {}

  static create(input: CreateInstallationInput, clock: Clock): Installation {
    const now = clock.now();

    return new Installation({
      id: InstallationId.of(input.id),
      customerId: input.customerId,
      licenseId: input.licenseId,
      installationCode: InstallationCode.create(input.installationCode),
      name: validateName(input.name),
      platform: input.platform,
      status: InstallationStatus.PENDING,
      registeredAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrates an Installation from already-validated persisted state - no re-validation. */
  static reconstitute(props: InstallationProps): Installation {
    return new Installation(props);
  }

  /**
   * Administrative status change. Deliberately cannot reach ACTIVE from PENDING - see
   * `isInstallationAdminTransitionAllowed`. Real activation is `activate()`, not this method.
   */
  changeStatus(next: InstallationStatus, clock: Clock): void {
    if (!isInstallationAdminTransitionAllowed(this.props.status, next)) {
      throw new InvalidInstallationStatusTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = clock.now();
  }

  /**
   * PENDING -> ACTIVE, stamping registeredAt. Reserved for CLOUD-01C's installation
   * credential/activation flow - domain-ready, but no CLOUD-01B use case calls this.
   */
  activate(clock: Clock): void {
    if (this.props.status !== InstallationStatus.PENDING) {
      throw new InvalidInstallationStatusTransitionError(
        this.props.status,
        InstallationStatus.ACTIVE,
      );
    }
    const now = clock.now();
    this.props.status = InstallationStatus.ACTIVE;
    this.props.registeredAt = now;
    this.props.updatedAt = now;
  }

  get id(): InstallationId {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get licenseId(): string {
    return this.props.licenseId;
  }

  get installationCode(): InstallationCode {
    return this.props.installationCode;
  }

  get name(): string {
    return this.props.name;
  }

  get platform(): Platform {
    return this.props.platform;
  }

  get status(): InstallationStatus {
    return this.props.status;
  }

  get registeredAt(): Date | null {
    return this.props.registeredAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function validateName(raw: string): string {
  const normalized = raw.trim();
  if (normalized.length < 1 || normalized.length > 150) {
    throw new InvalidInstallationNameError();
  }
  return normalized;
}
