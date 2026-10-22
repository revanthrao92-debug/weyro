import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';
import { CreateSparePartDto } from './dto/spare-parts.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  SparePartsQuery,
  sparePartsQuerySchema,
} from '../../common/dto/query.dto';
import {
  CreateSparePartOrderDto,
  VerifySparePartOrderDto,
} from './dto/spare-parts.dto';

@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly service: SparePartsService) {}

  @Public()
  @Get()
  async findAll(
    @Query(new ZodValidationPipe(sparePartsQuerySchema))
    query: SparePartsQuery,
  ) {
    return this.service.findAll({
      search: query.search,
      make: query.make,
      model: query.model,
      condition: query.condition,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Public()
  @Get('orders/my')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async findMyOrders(@CurrentUser() user: AuthUserPayload) {
    if (!user.customerProfileId) {
      throw new ForbiddenException('Customer profile required');
    }
    return this.service.findMyOrders(user.customerProfileId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('PROVIDER', 'ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateSparePartDto,
  ) {
    if (!user.providerProfileId && user.role !== 'ADMIN') {
      throw new ForbiddenException('Provider profile required to list spare parts');
    }
    return this.service.create(user.providerProfileId || user.sub, dto);
  }

  @Post(':id/orders')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateSparePartOrderDto,
  ) {
    if (!user.customerProfileId) {
      throw new ForbiddenException('Customer profile required to purchase');
    }
    return this.service.createOrder(id, user.customerProfileId, dto);
  }

  @Post('orders/:orderId/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: VerifySparePartOrderDto,
  ) {
    return this.service.verifyOrderPayment(
      orderId,
      user.role === 'ADMIN' ? 'ADMIN' : user.customerProfileId || null,
      dto,
    );
  }
}
