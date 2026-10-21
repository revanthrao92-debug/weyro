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

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('threads')
  async createThread(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateThreadDto,
  ) {
    return this.chatService.getOrCreateThread(user, dto);
  }

  @Get('threads')
  async getThreads(
    @CurrentUser() user: AuthUserPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getUserThreads(
      user,
      cursor,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('threads/:id/messages')
  async getMessages(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getThreadMessages(
      id,
      user,
      cursor,
      limit ? parseInt(limit, 10) : 30,
    );
  }

  @Post('threads/:id/messages')
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
