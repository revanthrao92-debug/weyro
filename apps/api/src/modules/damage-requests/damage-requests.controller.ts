import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DamageRequestsService } from './damage-requests.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('damage-requests')
export class DamageRequestsController {
  constructor(private readonly service: DamageRequestsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('upload')
  async uploadMedia(
    @Body()
    body: { base64?: string; filename?: string; mimeType?: string; url?: string },
  ) {
    return this.service.uploadMedia(body);
  }

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

  @Get('broadcast-feed')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async getBroadcastFeed(
    @CurrentUser() user: AuthUserPayload,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    if (user.role !== 'ADMIN' && user.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenException(
        'Only verified providers can access the broadcast feed',
      );
    }
    return this.service.getBroadcastFeed(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      radiusKm ? parseFloat(radiusKm) : 25,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.findOne(id, user);
  }
}
