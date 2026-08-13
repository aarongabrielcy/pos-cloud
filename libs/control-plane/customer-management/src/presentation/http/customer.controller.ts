import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  ApiErrorResponse,
  CurrentAdmin,
  type CurrentAdminPrincipal,
  PERMISSIONS,
  RequirePermissions,
} from "@pos-cloud/access-management";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import type { Request } from "express";
import { ChangeCustomerStatusUseCase } from "../../application/use-cases/change-customer-status.use-case";
import { CreateCustomerUseCase } from "../../application/use-cases/create-customer.use-case";
import { GetCustomerByIdUseCase } from "../../application/use-cases/get-customer-by-id.use-case";
import { ListCustomersUseCase } from "../../application/use-cases/list-customers.use-case";
import { CustomerNotFoundError } from "../../domain/customer.errors";
import { ChangeCustomerStatusRequestDto } from "./dto/change-customer-status.request.dto";
import { CreateCustomerRequestDto } from "./dto/create-customer.request.dto";
import { CustomerListResponseDto } from "./dto/customer-list.response.dto";
import { CustomerResponseDto } from "./dto/customer.response.dto";
import { ListCustomersQueryDto } from "./dto/list-customers.query.dto";

/** Same inline pattern AllExceptionsFilter already uses for reading the correlation id off the request. */
function buildAdminAuditActor(
  admin: CurrentAdminPrincipal,
  request: Request & { id?: string | number },
): AuditActorContext {
  return {
    actorType: "ADMIN",
    actorId: admin.adminUserId,
    correlationId: request.id !== undefined ? String(request.id) : "unknown",
  };
}

@ApiTags("customers")
@ApiBearerAuth("admin-bearer")
@ApiErrorResponse()
@Controller("api/v1/control-plane/customers")
export class CustomerController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly getCustomerByIdUseCase: GetCustomerByIdUseCase,
    private readonly listCustomersUseCase: ListCustomersUseCase,
    private readonly changeCustomerStatusUseCase: ChangeCustomerStatusUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS.CREATE)
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @ApiOperation({ summary: "Create a customer" })
  async create(
    @Body() body: CreateCustomerRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<CustomerResponseDto> {
    const customer = await this.createCustomerUseCase.execute(
      body,
      buildAdminAuditActor(admin, request),
    );
    return CustomerResponseDto.fromDomain(customer);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CUSTOMERS.READ)
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiOperation({ summary: "Get a customer by id" })
  async getById(@Param("id", ParseUUIDPipe) id: string): Promise<CustomerResponseDto> {
    const customer = await this.getCustomerByIdUseCase.execute(id);
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }
    return CustomerResponseDto.fromDomain(customer);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS.READ)
  @ApiOkResponse({ type: CustomerListResponseDto })
  @ApiOperation({ summary: "List customers" })
  async list(@Query() query: ListCustomersQueryDto): Promise<CustomerListResponseDto> {
    const result = await this.listCustomersUseCase.execute(query);
    return {
      items: result.items.map(CustomerResponseDto.fromDomain),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.CUSTOMERS.STATUS_CHANGE)
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiOperation({ summary: "Change a customer's status" })
  async changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ChangeCustomerStatusRequestDto,
    @CurrentAdmin() admin: CurrentAdminPrincipal,
    @Req() request: Request & { id?: string | number },
  ): Promise<CustomerResponseDto> {
    const customer = await this.changeCustomerStatusUseCase.execute(
      { id, status: body.status },
      buildAdminAuditActor(admin, request),
    );
    return CustomerResponseDto.fromDomain(customer);
  }
}
