import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType } from '../../database/entities/message.entity';
import { Match, MatchStatus } from '../../database/entities/match.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
    ) { }

    async getMessages(
        userId: string,
        matchId: string,
        pagination: PaginationDto,
    ) {
        // Verify user belongs to this match
        await this.verifyMatchParticipant(userId, matchId);

        const [messages, total] = await this.messageRepository.findAndCount({
            where: { matchId },
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
            relations: ['sender'],
        });

        return {
            messages: messages.reverse(),
            total,
            page: pagination.page,
            limit: pagination.limit,
        };
    }

    async sendMessage(
        senderId: string,
        matchId: string,
        content: string,
        type: MessageType = MessageType.TEXT,
    ): Promise<Message> {
        // Verify sender belongs to this match
        await this.verifyMatchParticipant(senderId, matchId);

        const message = this.messageRepository.create({
            matchId,
            senderId,
            content,
            type,
        });

        return this.messageRepository.save(message);
    }

    async markAsRead(userId: string, matchId: string): Promise<void> {
        await this.verifyMatchParticipant(userId, matchId);

        await this.messageRepository
            .createQueryBuilder()
            .update()
            .set({ readAt: new Date() })
            .where('matchId = :matchId', { matchId })
            .andWhere('senderId != :userId', { userId })
            .andWhere('readAt IS NULL')
            .execute();
    }

    async getUnreadCount(userId: string): Promise<number> {
        // Get all user's matches
        const matches = await this.matchRepository.find({
            where: [
                { user1Id: userId, status: MatchStatus.ACTIVE },
                { user2Id: userId, status: MatchStatus.ACTIVE },
            ],
            select: ['id'],
        });
        const matchIds = matches.map((m) => m.id);

        if (matchIds.length === 0) return 0;

        return this.messageRepository
            .createQueryBuilder('message')
            .where('message.matchId IN (:...matchIds)', { matchIds })
            .andWhere('message.senderId != :userId', { userId })
            .andWhere('message.readAt IS NULL')
            .getCount();
    }

    private async verifyMatchParticipant(
        userId: string,
        matchId: string,
    ): Promise<Match> {
        const match = await this.matchRepository.findOne({
            where: [
                { id: matchId, user1Id: userId, status: MatchStatus.ACTIVE },
                { id: matchId, user2Id: userId, status: MatchStatus.ACTIVE },
            ],
        });

        if (!match) {
            throw new ForbiddenException('You are not part of this match');
        }
        return match;
    }
}
