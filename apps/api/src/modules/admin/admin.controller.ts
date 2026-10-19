import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { VerifyProviderDto } from './dto/verify-provider.dto';
import { AdminAuthGuard } from '../auth/guards/admin.guard';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.service.getOverview();
  }

  @Get('providers')
  async getProviders(@Query('status') status?: string) {
    return this.service.getProviders(status);
  }

  @Patch('providers/:id/verify')
  async verifyProvider(
    @Param('id') id: string,
    @Body() dto: VerifyProviderDto
  ) {
    return this.service.verifyProvider(id, dto);
  }

  @Get('escrow-ledger')
  async getEscrowLedger() {
    return this.service.getEscrowLedger();
  }
}
