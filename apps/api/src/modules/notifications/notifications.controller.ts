import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DeletePushTokenDto, RegisterPushTokenDto } from './dto/notifications.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('push-token')
  async registerPushToken(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.service.registerPushToken(user.sub, dto);
  }

  @Delete('push-token')
  async deletePushToken(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: DeletePushTokenDto,
  ) {
    return this.service.deletePushToken(user.sub, dto.token);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthUserPayload) {
    return this.service.getUnreadCount(user.sub);
  }

  @Get()
  async getNotifications(
    @CurrentUser() user: AuthUserPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getUserNotifications(
      user.sub,
      cursor,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: AuthUserPayload) {
    return this.service.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.markAsRead(user.sub, id);
  }
}
