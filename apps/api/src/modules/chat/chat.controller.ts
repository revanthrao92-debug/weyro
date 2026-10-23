import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  CreateThreadDto,
  MarkReadDto,
  SendMessageDto,
} from './dto/chat.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CursorPaginationQuery,
  cursorPaginationSchema,
} from '../../common/dto/query.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('threads')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createThread(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateThreadDto,
  ) {
    return this.chatService.getOrCreateThread(user, dto);
  }

  @Get('threads')
  async getThreads(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(cursorPaginationSchema))
    query: CursorPaginationQuery,
  ) {
    return this.chatService.getUserThreads(user, query.cursor, query.limit);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthUserPayload) {
    return this.chatService.getUnreadCount(user);
  }

  @Get('threads/:id/messages')
  async getMessages(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(cursorPaginationSchema))
    query: CursorPaginationQuery,
  ) {
    return this.chatService.getThreadMessages(
      id,
      user,
      query.cursor,
      query.limit,
    );
  }

  @Post('threads/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async sendMessage(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      id,
      user,
      dto.content,
      dto.mediaUrls,
    );
  }

  @Patch('threads/:id/read')
  async markRead(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.chatService.markMessagesRead(id, user, dto.messageIds);
  }
}
