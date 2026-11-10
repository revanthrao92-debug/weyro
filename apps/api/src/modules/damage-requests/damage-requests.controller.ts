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
import { z } from 'zod';
import { DamageRequestsService } from './damage-requests.service';
import { CreateDamageRequestDto } from './dto/create-damage-request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { VerifiedProviderGuard } from '../../common/guards/verified-provider.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  cursorPaginationSchema,
  FeedQuery,
  feedQuerySchema,
} from '../../common/dto/query.dto';
import { idParamSchema } from '../../common/dto/id-param.schema';

const myRequestsQuerySchema = cursorPaginationSchema.extend({
  status: z
    .enum([
      'DRAFT',
      'OPEN',
      'QUOTES_RECEIVED',
      'ACCEPTED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
    ])
    .optional(),
});

type MyRequestsQuery = z.infer<typeof myRequestsQuerySchema>;

@Controller('damage-requests')
export class DamageRequestsController {
  constructor(private readonly service: DamageRequestsService) {}

  @Post()
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
    @Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery,
  ) {
    return this.service.getBroadcastFeed({
      providerId: user.providerProfileId,
      providerLat: query.lat,
      providerLng: query.lng,
      radiusKm: query.radiusKm,
      category: query.category,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get('my')
  async findMine(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(myRequestsQuerySchema))
    query: MyRequestsQuery,
  ) {
    return this.service.findMine(
      user,
      query.cursor,
      query.limit,
      query.status,
    );
  }

  @Post(':id/cancel')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  async cancel(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.cancel(id, user);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.findOne(id, user);
  }
}
