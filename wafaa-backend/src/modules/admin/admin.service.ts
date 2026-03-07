import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../database/entities/user.entity';
import { Report, ReportStatus } from '../../database/entities/report.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Match } from '../../database/entities/match.entity';
import { Subscription, SubscriptionPlan } from '../../database/entities/subscription.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Report)
        private readonly reportRepository: Repository<Report>,
        @InjectRepository(Profile)
        private readonly profileRepository: Repository<Profile>,
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
    ) { }

    async getUsers(pagination: PaginationDto, status?: UserStatus) {
        const where: any = {};
        if (status) where.status = status;

        const [users, total] = await this.userRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
        });

        return { users, total, page: pagination.page, limit: pagination.limit };
    }

    async updateUserStatus(userId: string, status: UserStatus): Promise<User | null> {
        await this.userRepository.update(userId, { status });
        return this.userRepository.findOne({ where: { id: userId } });
    }

    async getReports(pagination: PaginationDto, status?: ReportStatus) {
        const where: any = {};
        if (status) where.status = status;

        const [reports, total] = await this.reportRepository.findAndCount({
            where,
            relations: ['reporter', 'reported'],
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
        });

        return { reports, total, page: pagination.page, limit: pagination.limit };
    }

    async resolveReport(
        reportId: string,
        adminId: string,
        status: ReportStatus,
        moderatorNote?: string,
    ): Promise<Report | null> {
        await this.reportRepository.update(reportId, {
            status,
            moderatorNote,
            resolvedById: adminId,
        });
        return this.reportRepository.findOne({
            where: { id: reportId },
            relations: ['reporter', 'reported'],
        });
    }

    async getDashboardStats() {
        const [
            totalUsers,
            activeUsers,
            totalProfiles,
            totalMatches,
            pendingReports,
            premiumUsers,
        ] = await Promise.all([
            this.userRepository.count(),
            this.userRepository.count({ where: { status: UserStatus.ACTIVE } }),
            this.profileRepository.count(),
            this.matchRepository.count(),
            this.reportRepository.count({ where: { status: ReportStatus.PENDING } }),
            this.subscriptionRepository.count({
                where: [
                    { plan: SubscriptionPlan.PREMIUM, status: 'active' as any },
                    { plan: SubscriptionPlan.GOLD, status: 'active' as any },
                ],
            }),
        ]);

        // Users registered in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newUsersThisWeek = await this.userRepository
            .createQueryBuilder('user')
            .where('user.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
            .getCount();

        return {
            totalUsers,
            activeUsers,
            totalProfiles,
            totalMatches,
            pendingReports,
            premiumUsers,
            newUsersThisWeek,
            conversionRate:
                totalUsers > 0
                    ? ((premiumUsers / totalUsers) * 100).toFixed(2) + '%'
                    : '0%',
        };
    }
}
