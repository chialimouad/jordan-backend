import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

export enum BackgroundCheckStatus {
    NOT_STARTED = 'not_started',
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    PASSED = 'passed',
    FAILED = 'failed',
    ERROR = 'error',
}

export interface BackgroundCheckResult {
    status: BackgroundCheckStatus;
    checkId?: string;
    completedAt?: Date;
    details?: Record<string, any>;
}

@Injectable()
export class BackgroundCheckService {
    private readonly logger = new Logger(BackgroundCheckService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    /**
     * Initiate a background check for a user.
     * TODO: Integrate with a real background check provider (e.g., Checkr, Sterling, GoodHire).
     */
    async initiateCheck(userId: string, data: {
        fullName: string;
        dateOfBirth: string;
        ssn?: string;
        consentGiven: boolean;
    }): Promise<BackgroundCheckResult> {
        if (!data.consentGiven) {
            return { status: BackgroundCheckStatus.NOT_STARTED };
        }

        const apiKey = this.configService.get<string>('BACKGROUND_CHECK_API_KEY');

        if (!apiKey) {
            this.logger.warn('Background check API key not configured — returning mock result');
            // Mock: mark as passed for development
            await this.userRepository.update(userId, {
                backgroundCheckStatus: BackgroundCheckStatus.PASSED,
            } as any);

            return {
                status: BackgroundCheckStatus.PASSED,
                checkId: `mock_check_${Date.now()}`,
                completedAt: new Date(),
            };
        }

        try {
            // TODO: Replace with actual API call to background check provider
            // Example with Checkr:
            // const response = await fetch('https://api.checkr.com/v1/candidates', {
            //     method: 'POST',
            //     headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            //     body: JSON.stringify({
            //         first_name: data.fullName.split(' ')[0],
            //         last_name: data.fullName.split(' ').slice(1).join(' '),
            //         dob: data.dateOfBirth,
            //     }),
            // });

            this.logger.log(`Background check initiated for user ${userId}`);
            return {
                status: BackgroundCheckStatus.PENDING,
                checkId: `check_${Date.now()}`,
            };
        } catch (error) {
            this.logger.error(`Background check initiation failed for user ${userId}`, (error as Error).message);
            return {
                status: BackgroundCheckStatus.ERROR,
                details: { error: (error as Error).message },
            };
        }
    }

    /**
     * Handle webhook callback from background check provider.
     */
    async handleWebhook(payload: any): Promise<void> {
        // TODO: Parse provider-specific webhook payload
        const userId = payload?.metadata?.userId;
        const status = payload?.status;

        if (!userId) {
            this.logger.warn('Background check webhook missing userId');
            return;
        }

        const checkStatus = this.mapProviderStatus(status);

        await this.userRepository.update(userId, {
            backgroundCheckStatus: checkStatus,
        } as any);

        this.logger.log(`Background check updated for user ${userId}: ${checkStatus}`);
    }

    /**
     * Get the background check status for a user.
     */
    async getCheckStatus(userId: string): Promise<BackgroundCheckResult> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'backgroundCheckStatus' as any],
        });

        return {
            status: (user as any)?.backgroundCheckStatus || BackgroundCheckStatus.NOT_STARTED,
        };
    }

    private mapProviderStatus(providerStatus: string): BackgroundCheckStatus {
        const map: Record<string, BackgroundCheckStatus> = {
            'clear': BackgroundCheckStatus.PASSED,
            'consider': BackgroundCheckStatus.FAILED,
            'pending': BackgroundCheckStatus.PENDING,
            'suspended': BackgroundCheckStatus.ERROR,
        };
        return map[providerStatus?.toLowerCase()] || BackgroundCheckStatus.PENDING;
    }
}
