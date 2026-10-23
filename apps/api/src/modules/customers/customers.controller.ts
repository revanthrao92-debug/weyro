import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  CreateVehicleDto,
  UpdateAddressesDto,
  UpdateCustomerProfileDto,
  UpdateVehicleDto,
} from './dto/customers.dto';

@Controller('customers')
@Roles('CUSTOMER', 'BOTH')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: AuthUserPayload) {
    return this.customers.getProfile(user);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customers.updateProfile(user, dto);
  }

  @Get('me/addresses')
  async getAddresses(@CurrentUser() user: AuthUserPayload) {
    return this.customers.getAddresses(user);
  }

  @Put('me/addresses')
  async replaceAddresses(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateAddressesDto,
  ) {
    return this.customers.replaceAddresses(user, dto);
  }

  @Get('me/vehicles')
  async getVehicles(@CurrentUser() user: AuthUserPayload) {
    return this.customers.getVehicles(user);
  }

  @Post('me/vehicles')
  async createVehicle(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.customers.createVehicle(user, dto);
  }

  @Patch('me/vehicles/:id')
  async updateVehicle(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.customers.updateVehicle(user, id, dto);
  }

  @Delete('me/vehicles/:id')
  async deleteVehicle(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ) {
    return this.customers.deleteVehicle(user, id);
  }
}
