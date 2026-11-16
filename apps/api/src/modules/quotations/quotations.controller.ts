import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/create-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { VerifiedProviderGuard } from '../../common/guards/verified-provider.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { CursorPaginationQuery, cursorPaginationSchema } from '../../common/dto/query.dto';
import { idParamSchema } from '../../common/dto/id-param.schema';

const myQuotationsQuerySchema = cursorPaginationSchema.extend({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'])
    .optional(),
});

type MyQuotationsQuery = z.infer<typeof myQuotationsQuerySchema>;

@Controller()
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Post('damage-requests/:requestId/quotations')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  @UseGuards(VerifiedProviderGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async create(
    @Param('requestId', new ZodValidationPipe(idParamSchema)) requestId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.service.create(
      requestId,
      user.providerProfileId || user.sub,
      dto,
    );
  }

  @Get('damage-requests/:requestId/quotations')
  async findByRequest(
    @Param('requestId', new ZodValidationPipe(idParamSchema)) requestId: string,
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(cursorPaginationSchema))
    query: CursorPaginationQuery,
  ) {
    return this.service.findByRequest(
      requestId,
      user,
      query.cursor,
      query.limit,
    );
  }

  @Post('quotations/:id/accept')
  @Roles('CUSTOMER', 'BOTH', 'ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async accept(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: AcceptQuotationDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.accept(id, user, dto, idempotencyKey);
  }

  @Patch('quotations/:id')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async updateQuotation(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.service.updateQuotation(id, user, dto);
  }

  @Get('quotations/my')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async getMyQuotations(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(myQuotationsQuerySchema))
    query: MyQuotationsQuery,
  ) {
    return this.service.getMyQuotations(
      user,
      query.cursor,
      query.limit,
      query.status,
    );
  }

  @Post('quotations/:id/withdraw')
  @Roles('PROVIDER', 'BOTH', 'ADMIN')
  async withdraw(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.withdrawQuotation(id, user);
  }
}
