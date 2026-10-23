import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { ReleasePaymentDto } from './dto/release-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createOrder(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(dto, user);
  }

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyPayment(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(dto, user);
  }

  /**
   * Release escrow funds to the provider (admin only).
   */
  @Post('release')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async releasePayment(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ReleasePaymentDto,
  ) {
    return this.paymentsService.releasePayment(dto, user);
  }

  @Public()
  // Razorpay batches captured payments and retries; gateway traffic must not
  // share the 100/min default bucket that user requests are limited by.
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  @Post('webhook')
  async webhook(
    @Req() req: any,
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: any,
  ) {
    const rawBody = req.rawBody || JSON.stringify(payload);
    return this.paymentsService.handleWebhook(rawBody, signature, payload);
  }
}
