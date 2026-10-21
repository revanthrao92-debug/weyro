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
}
