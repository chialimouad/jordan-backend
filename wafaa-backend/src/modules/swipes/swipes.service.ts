import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from '../../database/entities/like.entity';
import { Match, MatchStatus } from '../../database/entities/match.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { Subscription, SubscriptionPlan } from '../../database/entities/subscription.entity';
import { CreateSwipeDto, SwipeAction } from './dto/swipe.dto';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

const FREE_DAILY_SWIPE_LIMIT = 25;

@Injectable()
export class SwipesService {
    private readonly logger = new Logger(SwipesService.name);

    constructor(
        @InjectRepository(Like)
        private readonly likeRepository: Repository<Like>,
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
        @InjectRepository(BlockedUser)
        private readonly blockedUserRepository: Repository<BlockedUser>,
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        private readonly redisService: RedisService,
        private readonly notificationsService: NotificationsService,
    ) { }

    async swipe(userId: string, dto: CreateSwipeDto) {
        const { targetUserId, action } = dto;

        // Prevent self-swipe
        if (userId === targetUserId) {
            throw new BadRequestException('Cannot swipe on yourself');
        }

        // Check if blocked
        const isBlocked = await this.blockedUserRepository.findOne({
            where: [
                { blockerId: userId, blockedId: targetUserId },
                { blockerId: targetUserId, blockedId: userId },
            ],
        });
        if (isBlocked) {
            throw new BadRequestException('Cannot interact with this user');
        }

        // Check duplicate swipe
        const existingSwipe = await this.likeRepository.findOne({
            where: { likerId: userId, likedId: targetUserId },
        });
        if (existingSwipe) {
            throw new BadRequestException('Already swiped on this user');
        }

        // Check daily swipe limit for free users
        await this.checkSwipeLimit(userId);

        // Create like/pass record
        const like = this.likeRepository.create({
            likerId: userId,
            likedId: targetUserId,
            isLike: action === SwipeAction.LIKE,
        });
        await this.likeRepository.save(like);

        // If liked, check for mutual match
        if (action === SwipeAction.LIKE) {
            const mutualLike = await this.likeRepository.findOne({
                where: { likerId: targetUserId, likedId: userId, isLike: true },
            });

            if (mutualLike) {
                // Create match!
                const match = await this.createMatch(userId, targetUserId);
                this.logger.log(`Match created between ${userId} and ${targetUserId}`);
                return { liked: true, matched: true, matchId: match.id };
            }
        }

        return { liked: action === SwipeAction.LIKE, matched: false };
    }

    private async createMatch(user1Id: string, user2Id: string): Promise<Match> {
        // Ensure consistent ordering (smaller UUID first)
        const [first, second] = [user1Id, user2Id].sort();

        const match = this.matchRepository.create({
            user1Id: first,
            user2Id: second,
            status: MatchStatus.ACTIVE,
        });

        const savedMatch = await this.matchRepository.save(match);

        // Notify both users
        await Promise.all([
            this.notificationsService.createNotification(user1Id, {
                type: 'match',
                title: 'New Match! 💚',
                body: 'You have a new match! Start a conversation.',
                data: { matchId: savedMatch.id, userId: user2Id },
            }),
            this.notificationsService.createNotification(user2Id, {
                type: 'match',
                title: 'New Match! 💚',
                body: 'You have a new match! Start a conversation.',
                data: { matchId: savedMatch.id, userId: user1Id },
            }),
        ]);

        return savedMatch;
    }

    private async checkSwipeLimit(userId: string): Promise<void> {
        // Check if premium user (unlimited swipes)
        const subscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'active' as any },
        });
        if (
            subscription &&
            subscription.plan !== SubscriptionPlan.FREE
        ) {
            return; // Premium users have unlimited swipes
        }

        // Check daily count via Redis
        const key = `swipes:${userId}:${new Date().toISOString().split('T')[0]}`;
        const allowed = await this.redisService.checkRateLimit(
            key,
            FREE_DAILY_SWIPE_LIMIT,
            86400, // 24 hours
        );
        if (!allowed) {
            throw new ForbiddenException(
                'Daily swipe limit reached. Upgrade to Premium for unlimited swipes.',
            );
        }
    }
}
