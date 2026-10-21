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
}
