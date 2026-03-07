import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../database/entities/notification.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
    ) { }

    async createNotification(
        userId: string,
        data: {
            type: string;
            title: string;
            body: string;
            data?: Record<string, any>;
        },
    ): Promise<Notification> {
        const notification = this.notificationRepository.create({
            userId,
            type: data.type as NotificationType,
            title: data.title,
            body: data.body,
            data: data.data,
        });
        return this.notificationRepository.save(notification);
    }

    async getNotifications(userId: string, pagination: PaginationDto) {
        const [notifications, total] = await this.notificationRepository.findAndCount({
            where: { userId },
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
        });

        const unreadCount = await this.notificationRepository.count({
            where: { userId, isRead: false },
        });

        return { notifications, total, unreadCount, page: pagination.page, limit: pagination.limit };
    }

    async markAsRead(userId: string, notificationId: string): Promise<void> {
        await this.notificationRepository.update(
            { id: notificationId, userId },
            { isRead: true },
        );
    }

    async markAllAsRead(userId: string): Promise<void> {
        await this.notificationRepository.update(
            { userId, isRead: false },
            { isRead: true },
        );
    }
}
