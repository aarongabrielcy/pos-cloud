import type { AuditEvent } from "@pos-cloud/audit";
import { type Customer, CustomerStatus } from "@pos-cloud/customer-management";
import type { Installation } from "@pos-cloud/installations";
import { InstallationStatus, Platform } from "@pos-cloud/installations";
import type { License, LicenseEntitlement } from "@pos-cloud/licensing";
import { LicenseEdition, LicenseModel, LicenseStatus } from "@pos-cloud/licensing";

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

/**
 * Value objects (CustomerCode, LicenseNumber, ...) are `type`-only exports - HTTP contract tests
 * never construct real ones. This gives a fake just enough shape (`toString()`) for a Response
 * DTO's `fromDomain()` to read, without depending on the real VO class or its validation.
 */
function stringValueObject(value: string): { toString(): string } {
  return { toString: () => value };
}

export function fakeCustomer(
  overrides: Partial<{
    id: string;
    code: string;
    legalName: string;
    tradeName: string | null;
    status: CustomerStatus;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Customer {
  return {
    id: stringValueObject(overrides.id ?? "11111111-1111-4111-8111-111111111111"),
    code: stringValueObject(overrides.code ?? "GST-MX"),
    legalName: stringValueObject(overrides.legalName ?? "GS Trackme S.A. de C.V."),
    tradeName:
      overrides.tradeName === null ? null : stringValueObject(overrides.tradeName ?? "GS Trackme"),
    status: overrides.status ?? CustomerStatus.ACTIVE,
    createdAt: overrides.createdAt ?? FIXED_DATE,
    updatedAt: overrides.updatedAt ?? FIXED_DATE,
  } as unknown as Customer;
}

/** Plain display-summary shape (CustomerDisplaySummary) - NOT a real Customer domain object, since
 *  GetCustomerSummariesUseCase's mocked `.execute()` resolves to a `Map<string, ...>` of exactly
 *  this shape, never a Customer. */
export function fakeCustomerSummary(
  overrides: Partial<{
    id: string;
    code: string;
    legalName: string;
    tradeName: string | null;
  }> = {},
): { id: string; code: string; legalName: string; tradeName: string | null } {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    code: overrides.code ?? "GST-MX",
    legalName: overrides.legalName ?? "GS Trackme S.A. de C.V.",
    tradeName: overrides.tradeName === undefined ? "GS Trackme" : overrides.tradeName,
  };
}

/** Same reasoning as fakeCustomerSummary - LicenseDisplaySummary, not a real License domain object. */
export function fakeLicenseSummary(
  overrides: Partial<{
    id: string;
    licenseNumber: string;
    edition: string;
    status: string;
  }> = {},
): { id: string; licenseNumber: string; edition: string; status: string } {
  return {
    id: overrides.id ?? "22222222-2222-4222-8222-222222222222",
    licenseNumber: overrides.licenseNumber ?? "LIC-GST-00001",
    edition: overrides.edition ?? "BASIC",
    status: overrides.status ?? "ACTIVE",
  };
}

export function fakeEntitlement(
  overrides: Partial<{
    id: string;
    code: string;
    enabled: boolean;
    configuration: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): LicenseEntitlement {
  return {
    id: overrides.id ?? "33333333-3333-4333-8333-333333333333",
    code: stringValueObject(overrides.code ?? "integrated_payments"),
    enabled: overrides.enabled ?? true,
    configuration: overrides.configuration ?? null,
    createdAt: overrides.createdAt ?? FIXED_DATE,
    updatedAt: overrides.updatedAt ?? FIXED_DATE,
  } as unknown as LicenseEntitlement;
}

export function fakeLicense(
  overrides: Partial<{
    id: string;
    customerId: string;
    licenseNumber: string;
    edition: LicenseEdition;
    licenseModel: LicenseModel;
    status: LicenseStatus;
    validFrom: Date;
    validUntil: Date | null;
    maxInstallations: number;
    entitlements: LicenseEntitlement[];
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): License {
  return {
    id: stringValueObject(overrides.id ?? "22222222-2222-4222-8222-222222222222"),
    customerId: overrides.customerId ?? "11111111-1111-4111-8111-111111111111",
    licenseNumber: stringValueObject(overrides.licenseNumber ?? "LIC-GST-00001"),
    edition: overrides.edition ?? LicenseEdition.BASIC,
    licenseModel: overrides.licenseModel ?? LicenseModel.PERPETUAL,
    status: overrides.status ?? LicenseStatus.ACTIVE,
    validFrom: overrides.validFrom ?? FIXED_DATE,
    validUntil: overrides.validUntil ?? null,
    maxInstallations: overrides.maxInstallations ?? 5,
    entitlements: overrides.entitlements ?? [fakeEntitlement()],
    createdAt: overrides.createdAt ?? FIXED_DATE,
    updatedAt: overrides.updatedAt ?? FIXED_DATE,
  } as unknown as License;
}

export function fakeInstallation(
  overrides: Partial<{
    id: string;
    customerId: string;
    licenseId: string;
    installationCode: string;
    name: string;
    platform: Platform;
    status: InstallationStatus;
    registeredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Installation {
  return {
    id: stringValueObject(overrides.id ?? "44444444-4444-4444-8444-444444444444"),
    customerId: overrides.customerId ?? "11111111-1111-4111-8111-111111111111",
    licenseId: overrides.licenseId ?? "22222222-2222-4222-8222-222222222222",
    installationCode: stringValueObject(overrides.installationCode ?? "POS-GST-00001"),
    name: overrides.name ?? "Sucursal Principal",
    platform: overrides.platform ?? Platform.WINDOWS,
    status: overrides.status ?? InstallationStatus.PENDING,
    registeredAt: overrides.registeredAt ?? null,
    createdAt: overrides.createdAt ?? FIXED_DATE,
    updatedAt: overrides.updatedAt ?? FIXED_DATE,
  } as unknown as Installation;
}

export function fakeAuditEvent(
  overrides: Partial<{
    id: string;
    occurredAt: Date;
    actorType: AuditEvent["actorType"];
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    correlationId: string;
    metadata: Record<string, unknown>;
  }> = {},
): AuditEvent {
  return {
    id: overrides.id ?? "55555555-5555-4555-8555-555555555555",
    occurredAt: overrides.occurredAt ?? FIXED_DATE,
    actorType: overrides.actorType ?? "ADMIN",
    actorId: overrides.actorId === null ? null : (overrides.actorId ?? "admin-1"),
    action: overrides.action ?? "customer.created",
    resourceType: overrides.resourceType ?? "Customer",
    resourceId: overrides.resourceId ?? "11111111-1111-4111-8111-111111111111",
    correlationId: overrides.correlationId ?? "correlation-1",
    metadata: overrides.metadata ?? {},
  };
}
