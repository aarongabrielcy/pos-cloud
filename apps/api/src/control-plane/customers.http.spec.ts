import type { INestApplication } from "@nestjs/common";
import {
  ChangeCustomerStatusUseCase,
  CreateCustomerUseCase,
  CustomerCodeAlreadyExistsError,
  CustomerManagementModule,
  CustomerNotFoundError,
  CustomerStatus,
  GetCustomerByIdUseCase,
  ListCustomersUseCase,
} from "@pos-cloud/customer-management";
import request from "supertest";
import { fakeCustomer } from "../test-support/fixtures";
import { createHttpTestModuleBuilder, initHttpTestApp } from "../test-support/http-test-app";

describe("Customers HTTP contract", () => {
  let app: INestApplication;
  let createCustomerUseCase: { execute: jest.Mock };
  let getCustomerByIdUseCase: { execute: jest.Mock };
  let listCustomersUseCase: { execute: jest.Mock };
  let changeCustomerStatusUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    createCustomerUseCase = { execute: jest.fn() };
    getCustomerByIdUseCase = { execute: jest.fn() };
    listCustomersUseCase = { execute: jest.fn() };
    changeCustomerStatusUseCase = { execute: jest.fn() };

    const moduleBuilder = createHttpTestModuleBuilder([CustomerManagementModule])
      .overrideProvider(CreateCustomerUseCase)
      .useValue(createCustomerUseCase)
      .overrideProvider(GetCustomerByIdUseCase)
      .useValue(getCustomerByIdUseCase)
      .overrideProvider(ListCustomersUseCase)
      .useValue(listCustomersUseCase)
      .overrideProvider(ChangeCustomerStatusUseCase)
      .useValue(changeCustomerStatusUseCase);

    app = await initHttpTestApp(moduleBuilder);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/control-plane/customers", () => {
    it("returns 201 for a valid request", async () => {
      createCustomerUseCase.execute.mockResolvedValue(fakeCustomer());

      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .send({ code: "GST-MX", legalName: "GS Trackme S.A. de C.V.", tradeName: "GS Trackme" });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ code: "GST-MX", status: CustomerStatus.ACTIVE });
      expect(createCustomerUseCase.execute).toHaveBeenCalledWith({
        code: "GST-MX",
        legalName: "GS Trackme S.A. de C.V.",
        tradeName: "GS Trackme",
      });
    });

    it("returns 400 when the body has an unknown property (forbidNonWhitelisted)", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .send({ code: "GST-MX", legalName: "GS Trackme S.A. de C.V.", extra: "nope" });

      expect(response.status).toBe(400);
      expect(createCustomerUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 400 when code is too short", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .send({ code: "", legalName: "GS Trackme S.A. de C.V." });

      expect(response.status).toBe(400);
    });

    it("returns 400 when legalName is invalid (below the DTO's minimum length)", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .send({ code: "GST-MX", legalName: "A" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/control-plane/customers/:id", () => {
    it("returns 400 for an invalid UUID", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers/not-a-uuid",
      );

      expect(response.status).toBe(400);
    });

    it("returns 200 for a valid UUID", async () => {
      getCustomerByIdUseCase.execute.mockResolvedValue(fakeCustomer());

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111",
      );

      expect(response.status).toBe(200);
      expect(response.body.id).toBe("11111111-1111-4111-8111-111111111111");
    });

    it("returns 404 with the error contract when the customer is missing", async () => {
      getCustomerByIdUseCase.execute.mockResolvedValue(null);

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers/99999999-9999-4999-8999-999999999999",
      );

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        code: "CUSTOMER_NOT_FOUND",
      });
      expect(typeof response.body.correlationId).toBe("string");
    });
  });

  describe("GET /api/v1/control-plane/customers", () => {
    beforeEach(() => {
      listCustomersUseCase.execute.mockResolvedValue({
        items: [fakeCustomer()],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns 200 with default pagination", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/control-plane/customers");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    });

    it("returns 400 for an invalid page", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers?page=0",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 when pageSize exceeds the maximum", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers?pageSize=101",
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid status", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers?status=NOT_A_STATUS",
      );

      expect(response.status).toBe(400);
    });

    it("accepts a search query parameter", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers?search=trackme",
      );

      expect(response.status).toBe(200);
      expect(listCustomersUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ search: "trackme" }),
      );
    });
  });

  describe("PATCH /api/v1/control-plane/customers/:id/status", () => {
    it("returns 200 for a valid status", async () => {
      changeCustomerStatusUseCase.execute.mockResolvedValue(
        fakeCustomer({ status: CustomerStatus.SUSPENDED }),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111/status")
        .send({ status: CustomerStatus.SUSPENDED });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(CustomerStatus.SUSPENDED);
    });

    it("returns 400 for an invalid status enum value", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111/status")
        .send({ status: "NOT_A_STATUS" });

      expect(response.status).toBe(400);
    });

    it("returns 409 with the error contract on a business ConflictError", async () => {
      changeCustomerStatusUseCase.execute.mockRejectedValue(
        new CustomerCodeAlreadyExistsError("GST-MX"),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111/status")
        .send({ status: CustomerStatus.SUSPENDED });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: "CUSTOMER_CODE_ALREADY_EXISTS",
        message: expect.any(String),
        correlationId: expect.any(String),
      });
    });

    it("returns 404 when the customer does not exist", async () => {
      changeCustomerStatusUseCase.execute.mockRejectedValue(
        new CustomerNotFoundError("11111111-1111-4111-8111-111111111111"),
      );

      const response = await request(app.getHttpServer())
        .patch("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111/status")
        .send({ status: CustomerStatus.SUSPENDED });

      expect(response.status).toBe(404);
    });
  });

  describe("error contract - 500", () => {
    it("sanitizes an unexpected error and never leaks internals", async () => {
      getCustomerByIdUseCase.execute.mockRejectedValue(
        new Error("connection refused at 10.0.0.5:5432"),
      );

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111",
      );

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        statusCode: 500,
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        correlationId: expect.any(String),
      });
      expect(JSON.stringify(response.body)).not.toContain("10.0.0.5");
    });
  });

  describe("correlation id", () => {
    it("echoes a valid inbound X-Correlation-Id on both success and error responses", async () => {
      getCustomerByIdUseCase.execute.mockResolvedValue(fakeCustomer());

      const response = await request(app.getHttpServer())
        .get("/api/v1/control-plane/customers/11111111-1111-4111-8111-111111111111")
        .set("X-Correlation-Id", "test-correlation-abc123");

      expect(response.headers["x-correlation-id"]).toBe("test-correlation-abc123");
    });

    it("generates a correlation id when none is supplied, and it reaches the error body", async () => {
      getCustomerByIdUseCase.execute.mockResolvedValue(null);

      const response = await request(app.getHttpServer()).get(
        "/api/v1/control-plane/customers/99999999-9999-4999-8999-999999999999",
      );

      expect(response.headers["x-correlation-id"]).toBeDefined();
      expect(response.body.correlationId).toBe(response.headers["x-correlation-id"]);
    });

    it("still gets a valid correlation id when the JSON body is malformed", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/control-plane/customers")
        .set("Content-Type", "application/json")
        .send('{"code": "GST-MX", "legalName": ');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(response.body.correlationId).not.toBe("unknown");
      expect(response.body.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(response.headers["x-correlation-id"]).toBe(response.body.correlationId);
      expect(createCustomerUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
