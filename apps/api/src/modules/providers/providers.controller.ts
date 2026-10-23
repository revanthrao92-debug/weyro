import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CursorPaginationQuery,
  cursorPaginationSchema,
} from '../../common/dto/query.dto';
import { UpdateProviderProfileDto } from './dto/providers.dto';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get('me')
  @Roles('PROVIDER', 'BOTH')
  async getMyProfile(@CurrentUser() user: AuthUserPayload) {
    return this.providers.getMyProfile(user);
  }

  @Patch('me')
  @Roles('PROVIDER', 'BOTH')
  async updateMyProfile(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.providers.updateMyProfile(user, dto);
  }

  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.providers.getPublicProfile(id);
  }

  @Public()
  @Get(':id/reviews')
  async getPublicReviews(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(cursorPaginationSchema))
    query: CursorPaginationQuery,
  ) {
    return this.providers.getPublicReviews(id, query.cursor, query.limit);
  }
}
