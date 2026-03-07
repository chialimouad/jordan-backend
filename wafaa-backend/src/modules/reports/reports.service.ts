import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from '../../database/entities/report.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { CreateReportDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Report)
        private readonly reportRepository: Repository<Report>,
        @InjectRepository(BlockedUser)
        private readonly blockedUserRepository: Repository<BlockedUser>,
    ) { }

    async createReport(userId: string, dto: CreateReportDto): Promise<Report> {
        if (userId === dto.reportedId) {
            throw new BadRequestException('Cannot report yourself');
        }

        // Check for existing report
        const existing = await this.reportRepository.findOne({
            where: { reporterId: userId, reportedId: dto.reportedId, status: 'pending' as any },
        });
        if (existing) {
            throw new BadRequestException('Report already pending for this user');
        }

        const report = this.reportRepository.create({
            reporterId: userId,
            reportedId: dto.reportedId,
            reason: dto.reason,
            details: dto.details,
        });

        return this.reportRepository.save(report);
    }

    async blockUser(userId: string, blockedId: string): Promise<void> {
        if (userId === blockedId) {
            throw new BadRequestException('Cannot block yourself');
        }

        const existing = await this.blockedUserRepository.findOne({
            where: { blockerId: userId, blockedId },
        });
        if (existing) {
            throw new BadRequestException('User already blocked');
        }

        const block = this.blockedUserRepository.create({
            blockerId: userId,
            blockedId,
        });
        await this.blockedUserRepository.save(block);
    }

    async unblockUser(userId: string, blockedId: string): Promise<void> {
        const block = await this.blockedUserRepository.findOne({
            where: { blockerId: userId, blockedId },
        });
        if (!block) throw new NotFoundException('User is not blocked');
        await this.blockedUserRepository.remove(block);
    }

    async getBlockedUsers(userId: string) {
        return this.blockedUserRepository.find({
            where: { blockerId: userId },
            relations: ['blocked'],
            order: { createdAt: 'DESC' },
        });
    }
}
