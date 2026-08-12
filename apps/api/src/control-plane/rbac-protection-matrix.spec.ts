import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AUTH_CONFIG, type AuthConfig } from "@pos-cloud/config";
import {
  AccessManagementModule,
  GetAdminProfileUseCase,
  IS_AUTHENTICATED_ONLY_KEY,
  IS_PUBLIC_KEY,
  LoginAdminUseCase,
  LogoutAdminUseCase,
  REQUIRED_PERMISSIONS_KEY,
  RefreshAdminSessionUseCase,
  type PermissionCode,
} from "@pos-cloud/access-management";
import {
  ChangeCustomerStatusUseCase,
  CreateCustomerUseCase,
  CustomerManagementModule,
  GetCustomerByIdUseCase,
  ListCustomersUseCase,
} from "@pos-cloud/customer-management";
import {
  ChangeInstallationStatusUseCase,
  CreateInstallationUseCase,
  GetInstallationByIdUseCase,
  InstallationsModule,
  ListInstallationsUseCase,
} from "@pos-cloud/installations";
import {
  ChangeLicenseStatusUseCase,
  CreateLicenseUseCase,
  GetLicenseByIdUseCase,
  LicensingModule,
  ListLicensesUseCase,
  ReplaceLicenseEntitlementsUseCase,
} from "@pos-cloud/licensing";
import { FakeDatabaseModule } from "../test-support/fake-database.module";

const fakeAuthConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

@Global()
@Module({ providers: [{ provide: AUTH_CONFIG, useValue: fakeAuthConfig }], exports: [AUTH_CONFIG] })
class TestAuthConfigModule {}

interface ExpectedHandler {
  controllerName: string;
  methodName: string;
  method: string;
  path: string;
  classification: "public" | "authenticatedOnly" | PermissionCode;
}

/**
 * The full protection matrix - 4 auth endpoints + 13 business endpoints - as data, cross-checked
 * against the real, live-compiled module graph below via NestJS's own DiscoveryService/
 * MetadataScanner (not a raw class import - controllers are deliberately excluded from every
 * package's public API, see access-management/src/index.ts's own comment; DiscoveryService reaches
 * them through Nest's internal module container instead, which has full visibility regardless).
 * A permission accidentally changed on any handler, or a new handler added without updating this
 * table, fails this test - see docs/architecture/admin-rbac.md#test-strategy.
 */
const EXPECTED_PROTECTION_MATRIX: ExpectedHandler[] = [
  {
    controllerName: "AuthController",
    methodName: "login",
    method: "POST",
    path: "login",
    classification: "public",
  },
  {
    controllerName: "AuthController",
    methodName: "refresh",
    method: "POST",
    path: "refresh",
    classification: "public",
  },
  {
    controllerName: "AuthController",
    methodName: "logout",
    method: "POST",
    path: "logout",
    classification: "public",
  },
  {
    controllerName: "AuthController",
    methodName: "me",
    method: "GET",
    path: "me",
    classification: "authenticatedOnly",
  },

  {
    controllerName: "CustomerController",
    methodName: "create",
    method: "POST",
    path: "",
    classification: "customers.create",
  },
  {
    controllerName: "CustomerController",
    methodName: "getById",
    method: "GET",
    path: ":id",
    classification: "customers.read",
  },
  {
    controllerName: "CustomerController",
    methodName: "list",
    method: "GET",
    path: "",
    classification: "customers.read",
  },
  {
    controllerName: "CustomerController",
    methodName: "changeStatus",
    method: "PATCH",
    path: ":id/status",
    classification: "customers.status.change",
  },

  {
    controllerName: "LicenseController",
    methodName: "create",
    method: "POST",
    path: "",
    classification: "licenses.create",
  },
  {
    controllerName: "LicenseController",
    methodName: "getById",
    method: "GET",
    path: ":id",
    classification: "licenses.read",
  },
  {
    controllerName: "LicenseController",
    methodName: "list",
    method: "GET",
    path: "",
    classification: "licenses.read",
  },
  {
    controllerName: "LicenseController",
    methodName: "changeStatus",
    method: "PATCH",
    path: ":id/status",
    classification: "licenses.status.change",
  },
  {
    controllerName: "LicenseController",
    methodName: "replaceEntitlements",
    method: "PUT",
    path: ":id/entitlements",
    classification: "licenses.entitlements.manage",
  },

  {
    controllerName: "InstallationController",
    methodName: "create",
    method: "POST",
    path: "",
    classification: "installations.create",
  },
  {
    controllerName: "InstallationController",
    methodName: "getById",
    method: "GET",
    path: ":id",
    classification: "installations.read",
  },
  {
    controllerName: "InstallationController",
    methodName: "list",
    method: "GET",
    path: "",
    classification: "installations.read",
  },
  {
    controllerName: "InstallationController",
    methodName: "changeStatus",
    method: "PATCH",
    path: ":id/status",
    classification: "installations.status.change",
  },
];

describe("RBAC protection matrix - metadata cross-check via DiscoveryService", () => {
  let discoveryService: DiscoveryService;
  let metadataScanner: MetadataScanner;
  let reflector: Reflector;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        FakeDatabaseModule,
        TestAuthConfigModule,
        AccessManagementModule,
        CustomerManagementModule,
        LicensingModule,
        InstallationsModule,
      ],
    })
      .overrideProvider(LoginAdminUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(RefreshAdminSessionUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(LogoutAdminUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetAdminProfileUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(CreateCustomerUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetCustomerByIdUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ListCustomersUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeCustomerStatusUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(CreateLicenseUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetLicenseByIdUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ListLicensesUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeLicenseStatusUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ReplaceLicenseEntitlementsUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(CreateInstallationUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(GetInstallationByIdUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ListInstallationsUseCase)
      .useValue({ execute: jest.fn() })
      .overrideProvider(ChangeInstallationStatusUseCase)
      .useValue({ execute: jest.fn() })
      .compile();

    discoveryService = moduleRef.get(DiscoveryService);
    metadataScanner = moduleRef.get(MetadataScanner);
    reflector = moduleRef.get(Reflector);
  });

  function findActualHandler(controllerName: string, methodName: string) {
    const wrappers = discoveryService.getControllers();
    const wrapper = wrappers.find((w) => w.metatype?.name === controllerName);
    if (!wrapper?.instance) {
      return null;
    }
    const prototype = Object.getPrototypeOf(wrapper.instance);
    const allMethodNames = metadataScanner.getAllMethodNames(prototype);
    if (!allMethodNames.includes(methodName)) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (wrapper.instance as any)[methodName] as (...args: unknown[]) => unknown;
    return { wrapper, handler };
  }

  it.each(EXPECTED_PROTECTION_MATRIX)(
    "$controllerName.$methodName ($method) is classified as $classification",
    ({ controllerName, methodName, method, classification }) => {
      const found = findActualHandler(controllerName, methodName);
      expect(found).not.toBeNull();
      const { wrapper, handler } = found!;

      expect(reflector.get(METHOD_METADATA, handler)).toBe(httpMethodToEnum(method));

      if (classification === "public") {
        const isPublic =
          reflector.get(IS_PUBLIC_KEY, handler) === true ||
          reflector.get(IS_PUBLIC_KEY, wrapper.metatype!) === true;
        expect(isPublic).toBe(true);
        return;
      }

      if (classification === "authenticatedOnly") {
        const isAuthenticatedOnly =
          reflector.get(IS_AUTHENTICATED_ONLY_KEY, handler) === true ||
          reflector.get(IS_AUTHENTICATED_ONLY_KEY, wrapper.metatype!) === true;
        expect(isAuthenticatedOnly).toBe(true);
        return;
      }

      const required = reflector.get<PermissionCode[] | undefined>(
        REQUIRED_PERMISSIONS_KEY,
        handler,
      );
      expect(required).toEqual([classification]);
    },
  );

  it("every discovered CustomerController/LicenseController/InstallationController handler is accounted for in the table above - a new endpoint added without updating this file fails here", () => {
    const businessControllerNames = [
      "CustomerController",
      "LicenseController",
      "InstallationController",
    ];
    const wrappers = discoveryService
      .getControllers()
      .filter((w) => businessControllerNames.includes(w.metatype?.name ?? ""));

    let discoveredHandlerCount = 0;
    for (const wrapper of wrappers) {
      if (!wrapper.instance) continue;
      const prototype = Object.getPrototypeOf(wrapper.instance);
      const methodNames = metadataScanner
        .getAllMethodNames(prototype)
        .filter(
          (name) => reflector.get(PATH_METADATA, (wrapper.instance as never)[name]) !== undefined,
        );
      discoveredHandlerCount += methodNames.length;
    }

    const expectedBusinessHandlerCount = EXPECTED_PROTECTION_MATRIX.filter((h) =>
      businessControllerNames.includes(h.controllerName),
    ).length;
    expect(discoveredHandlerCount).toBe(expectedBusinessHandlerCount);
  });
});

function httpMethodToEnum(method: string): number {
  // Mirrors @nestjs/common's internal RequestMethod enum values (GET=0, POST=1, PUT=2, DELETE=3,
  // PATCH=4, ...) - duplicated here rather than imported since RequestMethod isn't re-exported by
  // any package this test already depends on, and the mapping is stable/public NestJS API surface.
  switch (method) {
    case "GET":
      return 0;
    case "POST":
      return 1;
    case "PUT":
      return 2;
    case "DELETE":
      return 3;
    case "PATCH":
      return 4;
    default:
      throw new Error(`Unmapped HTTP method in test table: ${method}`);
  }
}
