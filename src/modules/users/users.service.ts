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

    async updateMe(
        userId: string,
        updateData: Partial<User>,
    ): Promise<User> {
        await this.userRepository.update(userId, updateData);
        await this.redisService.del(`user:${userId}`);
        return this.findById(userId);
    }

    async softDelete(userId: string): Promise<void> {
        await this.userRepository.softDelete(userId);
        await this.redisService.del(`user:${userId}`);
    }

    async getPublicProfile(userId: string): Promise<Partial<User>> {
        const user = await this.findById(userId);
        const { password, refreshToken, deletedAt, ...publicData } = user as any;
        return publicData;
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
