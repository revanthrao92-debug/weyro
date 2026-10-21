import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Throttle } from '@nestjs/throttler';

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

  @Public()
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
