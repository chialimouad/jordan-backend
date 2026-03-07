import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Get(':matchId/messages')
    @ApiOperation({ summary: 'Get chat messages for a match' })
    async getMessages(
        @CurrentUser('sub') userId: string,
        @Param('matchId') matchId: string,
        @Query() pagination: PaginationDto,
    ) {
        return this.chatService.getMessages(userId, matchId, pagination);
    }

    @Patch(':matchId/read')
    @ApiOperation({ summary: 'Mark all messages in a chat as read' })
    async markAsRead(
        @CurrentUser('sub') userId: string,
        @Param('matchId') matchId: string,
    ) {
        return this.chatService.markAsRead(userId, matchId);
    }

    @Get('unread')
    @ApiOperation({ summary: 'Get total unread message count' })
    async getUnreadCount(@CurrentUser('sub') userId: string) {
        const count = await this.chatService.getUnreadCount(userId);
        return { unreadCount: count };
    }
}
