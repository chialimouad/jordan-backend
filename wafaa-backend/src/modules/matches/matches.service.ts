import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Match, MatchStatus } from '../../database/entities/match.entity';
import { Like } from '../../database/entities/like.entity';
import { Profile } from '../../database/entities/profile.entity';
import { UserPreference } from '../../database/entities/user-preference.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { Photo } from '../../database/entities/photo.entity';
import { RedisService } from '../redis/redis.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class MatchesService {
    private readonly logger = new Logger(MatchesService.name);

    constructor(
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
        @InjectRepository(Like)
        private readonly likeRepository: Repository<Like>,
        @InjectRepository(Profile)
        private readonly profileRepository: Repository<Profile>,
        @InjectRepository(UserPreference)
        private readonly preferenceRepository: Repository<UserPreference>,
        @InjectRepository(BlockedUser)
        private readonly blockedUserRepository: Repository<BlockedUser>,
        @InjectRepository(Photo)
        private readonly photoRepository: Repository<Photo>,
        private readonly redisService: RedisService,
    ) { }

    async getMatches(userId: string, pagination: PaginationDto) {
        const [matches, total] = await this.matchRepository.findAndCount({
            where: [
                { user1Id: userId, status: MatchStatus.ACTIVE },
                { user2Id: userId, status: MatchStatus.ACTIVE },
            ],
            relations: ['user1', 'user2'],
            order: { matchedAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
        });

        // Enrich with photos
        const enriched = await Promise.all(
            matches.map(async (match) => {
                const otherUserId =
                    match.user1Id === userId ? match.user2Id : match.user1Id;
                const otherUser =
                    match.user1Id === userId ? match.user2 : match.user1;
                const photo = await this.photoRepository.findOne({
                    where: { userId: otherUserId, isMain: true },
                });
                return {
                    id: match.id,
                    matchedAt: match.matchedAt,
                    user: {
                        id: otherUser.id,
                        firstName: otherUser.firstName,
                        lastName: otherUser.lastName,
                        photo: photo?.url || null,
                    },
                };
            }),
        );

        return { matches: enriched, total, page: pagination.page, limit: pagination.limit };
    }

    async unmatch(userId: string, matchId: string): Promise<void> {
        const match = await this.matchRepository.findOne({
            where: [
                { id: matchId, user1Id: userId },
                { id: matchId, user2Id: userId },
            ],
        });
        if (!match) throw new NotFoundException('Match not found');

        match.status = MatchStatus.UNMATCHED;
        await this.matchRepository.save(match);
    }

    async getSuggestions(userId: string, limit: number = 20) {
        // Try cache first
        const cacheKey = `suggestions:${userId}`;
        const cached = await this.redisService.getJson<any[]>(cacheKey);
        if (cached && cached.length > 0) return cached;

        // Get user profile and preferences
        const profile = await this.profileRepository.findOne({
            where: { userId },
        });
        const preferences = await this.preferenceRepository.findOne({
            where: { userId },
        });

        if (!profile) {
            return [];
        }

        // Get blocked users (both directions)
        const blockedUsers = await this.blockedUserRepository.find({
            where: [{ blockerId: userId }, { blockedId: userId }],
        });
        const blockedIds = blockedUsers.map((b) =>
            b.blockerId === userId ? b.blockedId : b.blockerId,
        );

        // Get already swiped users
        const swipedLikes = await this.likeRepository.find({
            where: { likerId: userId },
            select: ['likedId'],
        });
        const swipedIds = swipedLikes.map((l) => l.likedId);

        // Get already matched users
        const matches = await this.matchRepository.find({
            where: [
                { user1Id: userId, status: MatchStatus.ACTIVE },
                { user2Id: userId, status: MatchStatus.ACTIVE },
            ],
        });
        const matchedIds = matches.map((m) =>
            m.user1Id === userId ? m.user2Id : m.user1Id,
        );

        // Combine all excluded IDs
        const excludeIds = [...new Set([userId, ...blockedIds, ...swipedIds, ...matchedIds])];

        // Build recommendation query
        const query = this.profileRepository
            .createQueryBuilder('profile')
            .leftJoinAndSelect('profile.user', 'user')
            .where('profile.userId NOT IN (:...excludeIds)', { excludeIds })
            .andWhere('user.status = :status', { status: 'active' })
            .andWhere('profile.isComplete = :complete', { complete: true });

        // Apply preference filters
        if (preferences) {
            if (preferences.preferredGender) {
                query.andWhere('profile.gender = :gender', {
                    gender: preferences.preferredGender,
                });
            }

            if (preferences.minAge || preferences.maxAge) {
                const now = new Date();
                if (preferences.maxAge) {
                    const minDate = new Date(
                        now.getFullYear() - preferences.maxAge,
                        now.getMonth(),
                        now.getDate(),
                    );
                    query.andWhere('profile.dateOfBirth >= :minDate', { minDate });
                }
                if (preferences.minAge) {
                    const maxDate = new Date(
                        now.getFullYear() - preferences.minAge,
                        now.getMonth(),
                        now.getDate(),
                    );
                    query.andWhere('profile.dateOfBirth <= :maxDate', { maxDate });
                }
            }

            if (preferences.preferredReligiousLevel) {
                query.andWhere('profile.religiousLevel = :religiousLevel', {
                    religiousLevel: preferences.preferredReligiousLevel,
                });
            }
        }

        // Order by activity score (most active first) for better engagement
        query.orderBy('profile.activityScore', 'DESC');
        query.addOrderBy('profile.createdAt', 'DESC');
        query.take(limit);

        const suggestions = await query.getMany();

        // Enrich with photos
        const enriched = await Promise.all(
            suggestions.map(async (p) => {
                const photo = await this.photoRepository.findOne({
                    where: { userId: p.userId, isMain: true },
                });
                return {
                    userId: p.userId,
                    firstName: p.user?.firstName,
                    lastName: p.user?.lastName,
                    age: this.calculateAge(p.dateOfBirth),
                    bio: p.bio,
                    city: p.city,
                    country: p.country,
                    gender: p.gender,
                    religiousLevel: p.religiousLevel,
                    interests: p.interests,
                    photo: photo?.url || null,
                };
            }),
        );

        // Cache for 10 minutes
        await this.redisService.setJson(cacheKey, enriched, 600);

        return enriched;
    }

    private calculateAge(dateOfBirth: Date): number {
        const today = new Date();
        const birth = new Date(dateOfBirth);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }
}
