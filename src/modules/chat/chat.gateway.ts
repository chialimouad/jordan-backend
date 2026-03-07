import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly chatService: ChatService,
        private readonly redisService: RedisService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.query.userId as string;
            if (!userId) {
                client.disconnect();
                return;
            }

            client.data.userId = userId;
            await this.redisService.setUserOnline(userId);
            client.join(`user:${userId}`);

            this.logger.log(`Client connected: ${userId}`);

            // Broadcast online status
            this.server.emit('userOnline', { userId });
        } catch (error) {
            client.disconnect();
        }
    }

    async handleDisconnect(client: Socket) {
        const userId = client.data?.userId;
        if (userId) {
            await this.redisService.setUserOffline(userId);
            this.server.emit('userOffline', { userId });
            this.logger.log(`Client disconnected: ${userId}`);
        }
    }

    @SubscribeMessage('sendMessage')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: { matchId: string; content: string },
    ) {
        const senderId = client.data.userId;
        const { matchId, content } = payload;

        try {
            const message = await this.chatService.sendMessage(
                senderId,
                matchId,
                content,
            );

            // Emit to the match room
            this.server.to(`match:${matchId}`).emit('newMessage', {
                id: message.id,
                matchId: message.matchId,
                senderId: message.senderId,
                content: message.content,
                type: message.type,
                createdAt: message.createdAt,
            });

            return { success: true, messageId: message.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('joinMatch')
    async handleJoinMatch(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { matchId: string },
    ) {
        client.join(`match:${payload.matchId}`);
        return { success: true };
    }

    @SubscribeMessage('leaveMatch')
    async handleLeaveMatch(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { matchId: string },
    ) {
        client.leave(`match:${payload.matchId}`);
        return { success: true };
    }

    @SubscribeMessage('typing')
    async handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { matchId: string },
    ) {
        const senderId = client.data.userId;
        client.to(`match:${payload.matchId}`).emit('userTyping', {
            matchId: payload.matchId,
            userId: senderId,
        });
    }

    @SubscribeMessage('stopTyping')
    async handleStopTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { matchId: string },
    ) {
        const senderId = client.data.userId;
        client.to(`match:${payload.matchId}`).emit('userStoppedTyping', {
            matchId: payload.matchId,
            userId: senderId,
        });
    }

    @SubscribeMessage('markRead')
    async handleMarkRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { matchId: string },
    ) {
        const userId = client.data.userId;
        await this.chatService.markAsRead(userId, payload.matchId);

        client.to(`match:${payload.matchId}`).emit('messagesRead', {
            matchId: payload.matchId,
            readBy: userId,
        });

        return { success: true };
    }

    @SubscribeMessage('checkOnline')
    async handleCheckOnline(
        @MessageBody() payload: { userId: string },
    ) {
        const isOnline = await this.redisService.isUserOnline(payload.userId);
        return { userId: payload.userId, online: isOnline };
    }
}
