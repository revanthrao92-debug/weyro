import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DriverGoCustomerService } from './driver-go-customer.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { idParamSchema } from '../../common/dto/id-param.schema';
import {
  CreateDriverBookingDto,
  availableDriversQuerySchema,
  type AvailableDriversQuery,
} from './dto/customer.dto';

@Controller('driver-go')
@Roles('CUSTOMER', 'BOTH')
export class DriverGoCustomerController {
  constructor(private readonly service: DriverGoCustomerService) {}

  @Get('drivers')
  async listDrivers(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(availableDriversQuerySchema))
    query: AvailableDriversQuery,
  ) {
    return this.service.listDrivers(user, query);
  }

  @Post('bookings')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createBooking(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateDriverBookingDto,
  ) {
    return this.service.createBooking(user, dto);
  }

  @Get('bookings')
  async listBookings(@CurrentUser() user: AuthUserPayload) {
    return this.service.listBookings(user);
  }

  @Get('bookings/:id')
  async getBooking(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    return this.service.getBooking(user, id);
  }

  @Post('bookings/:id/cancel')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async cancelBooking(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    return this.service.cancelBooking(user, id);
  }

  @Get('bookings/:id/start-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getStartCode(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    return this.service.getStartCode(user, id);
  }
}
