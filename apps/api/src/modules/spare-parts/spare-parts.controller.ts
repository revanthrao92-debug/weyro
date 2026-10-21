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

@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly service: SparePartsService) {}

  @Public()
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('make') make?: string,
    @Query('model') model?: string,
    @Query('condition') condition?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      search,
      make,
      model,
      condition,
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('PROVIDER', 'ADMIN')
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
