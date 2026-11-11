import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DriverGoService } from './driver-go.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { idParamSchema } from '../../common/dto/id-param.schema';
import {
  DeclineDriverJobDto,
  DriverAvailabilityDto,
  DriverJobStatusDto,
  DriverStartOtpDto,
  UpdateDriverOnlineDto,
  type DriverJobsQuery,
  driverJobsQuerySchema,
} from './dto/driver-go.dto';

@Controller('driver-go')
@Roles('PROVIDER', 'BOTH')
export class DriverGoController {
  constructor(private readonly service: DriverGoService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthUserPayload) {
    return this.service.getMe(user);
  }

  @Patch('online')
  async setOnline(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateDriverOnlineDto,
  ) {
    return this.service.setOnline(user, dto.isOnline);
  }

  @Get('availability')
  async getAvailability(@CurrentUser() user: AuthUserPayload) {
    return this.service.getAvailability(user);
  }

  @Put('availability')
  async setAvailability(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: DriverAvailabilityDto,
  ) {
    return this.service.setAvailability(user, dto);
  }

  @Get('jobs')
  async getJobs(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(driverJobsQuerySchema))
    query: DriverJobsQuery,
  ) {
    return this.service.getJobs(user, query.status);
  }

  @Get('jobs/:id')
  async getJob(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    return this.service.getJob(user, id);
  }

  @Post('jobs/:id/accept')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async accept(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ) {
    return this.service.accept(user, id);
  }

  @Post('jobs/:id/decline')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async decline(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body() dto: DeclineDriverJobDto,
  ) {
    return this.service.decline(user, id, dto);
  }

  @Patch('jobs/:id/status')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async updateStatus(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body() dto: DriverJobStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }

  @Post('jobs/:id/verify-start-otp')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyStartOtp(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body() dto: DriverStartOtpDto,
  ) {
    return this.service.verifyStartOtp(user, id, dto.code);
  }

  @Get('earnings')
  async getEarnings(@CurrentUser() user: AuthUserPayload) {
    return this.service.getEarnings(user);
  }
}
