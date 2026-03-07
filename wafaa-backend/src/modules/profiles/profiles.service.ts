import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../../database/entities/profile.entity';
import { UserPreference } from '../../database/entities/user-preference.entity';
import { CreateProfileDto, UpdateProfileDto, UpdatePreferencesDto } from './dto/profile.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ProfilesService {
    constructor(
        @InjectRepository(Profile)
        private readonly profileRepository: Repository<Profile>,
        @InjectRepository(UserPreference)
        private readonly preferenceRepository: Repository<UserPreference>,
        private readonly redisService: RedisService,
    ) { }

    async getMyProfile(userId: string): Promise<Profile> {
        const cached = await this.redisService.getJson<Profile>(`profile:${userId}`);
        if (cached) return cached;

        const profile = await this.profileRepository.findOne({
            where: { userId },
            relations: ['user'],
        });
        if (!profile) throw new NotFoundException('Profile not found. Please create one.');

        await this.redisService.setJson(`profile:${userId}`, profile, 300);
        return profile;
    }

    async createOrUpdateProfile(
        userId: string,
        dto: CreateProfileDto | UpdateProfileDto,
    ): Promise<Profile> {
        let profile = await this.profileRepository.findOne({ where: { userId } });

        if (profile) {
            Object.assign(profile, dto);
        } else {
            profile = this.profileRepository.create({ ...dto, userId });
        }

        // Check completeness
        profile.isComplete = this.checkCompleteness(profile);

        const saved = await this.profileRepository.save(profile);
        await this.redisService.del(`profile:${userId}`);
        return saved;
    }

    async getProfileById(profileUserId: string): Promise<Profile> {
        const cached = await this.redisService.getJson<Profile>(`profile:${profileUserId}`);
        if (cached) return cached;

        const profile = await this.profileRepository.findOne({
            where: { userId: profileUserId },
            relations: ['user'],
        });
        if (!profile) throw new NotFoundException('Profile not found');

        await this.redisService.setJson(`profile:${profileUserId}`, profile, 300);
        return profile;
    }

    async getPreferences(userId: string): Promise<UserPreference> {
        let prefs = await this.preferenceRepository.findOne({ where: { userId } });
        if (!prefs) {
            prefs = this.preferenceRepository.create({ userId });
            await this.preferenceRepository.save(prefs);
        }
        return prefs;
    }

    async updatePreferences(
        userId: string,
        dto: UpdatePreferencesDto,
    ): Promise<UserPreference> {
        let prefs = await this.preferenceRepository.findOne({ where: { userId } });
        if (!prefs) {
            prefs = this.preferenceRepository.create({ ...dto, userId });
        } else {
            Object.assign(prefs, dto);
        }
        return this.preferenceRepository.save(prefs);
    }

    async updateActivityScore(userId: string, score: number): Promise<void> {
        await this.profileRepository.update({ userId }, { activityScore: score });
        await this.redisService.del(`profile:${userId}`);
    }

    private checkCompleteness(profile: Profile): boolean {
        return !!(
            profile.gender &&
            profile.dateOfBirth &&
            profile.bio &&
            profile.city &&
            profile.country
        );
    }
}
