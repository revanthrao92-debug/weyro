import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { VerifyProviderDto } from './dto/verify-provider.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { AdminAuthGuard } from '../auth/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ProviderAdminQuery,
  providerAdminQuerySchema,
  AdminActivityQuery,
  adminActivityQuerySchema,
} from '../../common/dto/query.dto';

@Controller('admin')
@UseGuards(AdminAuthGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.service.getOverview();
  }

  @Get('providers')
  async getProviders(
    @Query(new ZodValidationPipe(providerAdminQuerySchema))
    query: ProviderAdminQuery,
  ) {
    return this.service.getProviders(query.status);
  }

  @Get('providers/:id')
  async getProviderDetail(@Param('id') id: string) {
    return this.service.getProviderDetail(id);
  }

  @Patch('providers/:id/verify')
  async verifyProvider(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: VerifyProviderDto,
  ) {
    return this.service.verifyProvider(id, dto, user.sub);
  }

  @Get('escrow-ledger')
  async getEscrowLedger() {
    return this.service.getEscrowLedger();
  }

  @Get('activity-logs')
  async getActivityLogs(
    @Query(new ZodValidationPipe(adminActivityQuerySchema))
    query: AdminActivityQuery,
  ) {
    return this.service.getActivityLogs({
      action: query.action,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get('activity-stats')
  async getActivityStats() {
    return this.service.getActivityStats();
  }
}
