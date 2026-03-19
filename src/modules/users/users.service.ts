import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../database/entities/user.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly redisService: RedisService,
    ) { }

    async findById(id: string): Promise<User> {
        // Try cache first
        const cached = await this.redisService.getJson<User>(`user:${id}`);
        if (cached) return cached;

        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        // Cache for 5 minutes
        await this.redisService.setJson(`user:${id}`, user, 300);
        return user;
    }

    async findByEmail(email: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async getMe(userId: string): Promise<User> {
        return this.findById(userId);
    }

    // Fields a user is allowed to modify on their own account
    private static readonly ALLOWED_UPDATE_FIELDS = new Set([
        'firstName', 'lastName', 'phone', 'username',
        'notificationsEnabled', 'matchNotifications',
        'messageNotifications', 'likeNotifications',
        'locationEnabled',
    ]);

    async updateMe(
        userId: string,
        updateData: Partial<User>,
    ): Promise<User> {
        // Strip any fields the user is not allowed to set (prevents privilege escalation)
        const safeData: Record<string, any> = {};
        for (const [key, value] of Object.entries(updateData)) {
            if (UsersService.ALLOWED_UPDATE_FIELDS.has(key)) {
                safeData[key] = value;
            }
        }

        if (Object.keys(safeData).length > 0) {
            await this.userRepository.update(userId, safeData);
            await this.redisService.del(`user:${userId}`);
        }
        return this.findById(userId);
    }

    async softDelete(userId: string): Promise<void> {
        await this.userRepository.softDelete(userId);
        await this.redisService.del(`user:${userId}`);
    }

    async getPublicProfile(userId: string): Promise<Partial<User>> {
        const user = await this.findById(userId);
        // Explicit whitelist — never expose sensitive fields to other users
        return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            selfieVerified: user.selfieVerified,
            createdAt: user.createdAt,
        } as Partial<User>;
    }

    async updateStatus(userId: string, status: UserStatus): Promise<void> {
        await this.userRepository.update(userId, { status });
        await this.redisService.del(`user:${userId}`);
    }

    async findAll(page: number, limit: number) {
        const [users, total] = await this.userRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
        });
        return { users, total, page, limit };
    }
}
