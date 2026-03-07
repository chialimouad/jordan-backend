import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly baseUrl: string;
    private readonly token: string;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('redis.url') || '';
        this.token = this.configService.get<string>('redis.token') || '';
        this.logger.log('Redis service initialized (Upstash REST)');
    }

    async onModuleDestroy() {
        this.logger.log('Redis service destroyed');
    }

    private async execute(command: string[]): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(command),
            });
            const data = await response.json();
            return data.result;
        } catch (error) {
            this.logger.error(`Redis command failed: ${command[0]}`, error);
            return null;
        }
    }

    async get(key: string): Promise<string | null> {
        return this.execute(['GET', key]);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.execute(['SET', key, value, 'EX', ttlSeconds.toString()]);
        } else {
            await this.execute(['SET', key, value]);
        }
    }

    async del(key: string): Promise<void> {
        await this.execute(['DEL', key]);
    }

    async setJson(key: string, value: any, ttlSeconds?: number): Promise<void> {
        await this.set(key, JSON.stringify(value), ttlSeconds);
    }

    async getJson<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.execute(['EXISTS', key]);
        return result === 1;
    }

    async expire(key: string, ttlSeconds: number): Promise<void> {
        await this.execute(['EXPIRE', key, ttlSeconds.toString()]);
    }

    async incr(key: string): Promise<number> {
        return this.execute(['INCR', key]);
    }

    async sadd(key: string, ...members: string[]): Promise<void> {
        await this.execute(['SADD', key, ...members]);
    }

    async srem(key: string, ...members: string[]): Promise<void> {
        await this.execute(['SREM', key, ...members]);
    }

    async smembers(key: string): Promise<string[]> {
        return this.execute(['SMEMBERS', key]) || [];
    }

    async sismember(key: string, member: string): Promise<boolean> {
        const result = await this.execute(['SISMEMBER', key, member]);
        return result === 1;
    }

    // Online presence
    async setUserOnline(userId: string): Promise<void> {
        await this.sadd('online_users', userId);
        await this.set(`user:${userId}:last_seen`, new Date().toISOString(), 300);
    }

    async setUserOffline(userId: string): Promise<void> {
        await this.srem('online_users', userId);
        await this.set(`user:${userId}:last_seen`, new Date().toISOString());
    }

    async isUserOnline(userId: string): Promise<boolean> {
        return this.sismember('online_users', userId);
    }

    async getOnlineUsers(): Promise<string[]> {
        return this.smembers('online_users');
    }

    // Rate limiting
    async checkRateLimit(
        key: string,
        limit: number,
        windowSeconds: number,
    ): Promise<boolean> {
        const current = await this.incr(`ratelimit:${key}`);
        if (current === 1) {
            await this.expire(`ratelimit:${key}`, windowSeconds);
        }
        return current <= limit;
    }
}
