import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../../database/entities/profile.entity';
import { Photo } from '../../database/entities/photo.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { SearchFiltersDto } from './dto/search.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SearchService {
    constructor(
        @InjectRepository(Profile)
        private readonly profileRepository: Repository<Profile>,
        @InjectRepository(Photo)
        private readonly photoRepository: Repository<Photo>,
        @InjectRepository(BlockedUser)
        private readonly blockedUserRepository: Repository<BlockedUser>,
        private readonly redisService: RedisService,
    ) { }

    async search(userId: string, filters: SearchFiltersDto) {
        // Check cache
        const cacheKey = `search:${userId}:${JSON.stringify(filters)}`;
        const cached = await this.redisService.getJson<any>(cacheKey);
        if (cached) return cached;

        // Get blocked users
        const blockedUsers = await this.blockedUserRepository.find({
            where: [{ blockerId: userId }, { blockedId: userId }],
        });
        const blockedIds = blockedUsers.map((b) =>
            b.blockerId === userId ? b.blockedId : b.blockerId,
        );
        const excludeIds = [userId, ...blockedIds];

        // Build query
        const query = this.profileRepository
            .createQueryBuilder('profile')
            .leftJoinAndSelect('profile.user', 'user')
            .where('profile.userId NOT IN (:...excludeIds)', { excludeIds })
            .andWhere('user.status = :status', { status: 'active' })
            .andWhere('profile.isComplete = :complete', { complete: true });

        // Apply filters
        if (filters.gender) {
            query.andWhere('profile.gender = :gender', { gender: filters.gender });
        }

        if (filters.city) {
            query.andWhere('LOWER(profile.city) LIKE LOWER(:city)', {
                city: `%${filters.city}%`,
            });
        }

        if (filters.country) {
            query.andWhere('LOWER(profile.country) LIKE LOWER(:country)', {
                country: `%${filters.country}%`,
            });
        }

        if (filters.maritalStatus) {
            query.andWhere('profile.maritalStatus = :maritalStatus', {
                maritalStatus: filters.maritalStatus,
            });
        }

        if (filters.religiousLevel) {
            query.andWhere('profile.religiousLevel = :religiousLevel', {
                religiousLevel: filters.religiousLevel,
            });
        }

        if (filters.ethnicity) {
            query.andWhere('LOWER(profile.ethnicity) LIKE LOWER(:ethnicity)', {
                ethnicity: `%${filters.ethnicity}%`,
            });
        }

        // Age filter
        if (filters.minAge || filters.maxAge) {
            const now = new Date();
            if (filters.maxAge) {
                const minDate = new Date(
                    now.getFullYear() - filters.maxAge,
                    now.getMonth(),
                    now.getDate(),
                );
                query.andWhere('profile.dateOfBirth >= :minDate', { minDate });
            }
            if (filters.minAge) {
                const maxDate = new Date(
                    now.getFullYear() - filters.minAge,
                    now.getMonth(),
                    now.getDate(),
                );
                query.andWhere('profile.dateOfBirth <= :maxDate', { maxDate });
            }
        }

        // Full-text search on bio
        if (filters.q) {
            query.andWhere('LOWER(profile.bio) LIKE LOWER(:q)', {
                q: `%${filters.q}%`,
            });
        }

        query.orderBy('profile.activityScore', 'DESC');
        query.skip(((filters.page ?? 1) - 1) * (filters.limit ?? 20));
        query.take(filters.limit ?? 20);

        const [profiles, total] = await query.getManyAndCount();

        // Enrich with photos
        const results = await Promise.all(
            profiles.map(async (p) => {
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
                    maritalStatus: p.maritalStatus,
                    interests: p.interests,
                    photo: photo?.url || null,
                };
            }),
        );

        const response = {
            results,
            total,
            page: filters.page,
            limit: filters.limit,
        };

        // Cache for 5 minutes
        await this.redisService.setJson(cacheKey, response, 300);

        return response;
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
