import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DamageRequestsService } from './damage-requests.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { VerifiedProviderGuard } from '../../common/guards/verified-provider.guard';

@Controller('damage-requests')
export class DamageRequestsController {
  constructor(private readonly service: DamageRequestsService) {}

  @Post()
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateDamageRequestDto,
  ) {
    if (!user.customerProfileId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Customer profile required to create service requests',
      );
    }
    return this.service.create(user.customerProfileId || user.sub, dto);
  }

  @Get(['broadcast-feed', 'feed'])
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  @UseGuards(VerifiedProviderGuard)
  async getBroadcastFeed(
    @CurrentUser() user: AuthUserPayload,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getBroadcastFeed({
      providerId: user.providerProfileId,
      providerLat: lat ? parseFloat(lat) : undefined,
      providerLng: lng ? parseFloat(lng) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : 25,
      category,
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.findOne(id, user);
  }
}
