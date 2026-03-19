import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuccessStory, SuccessStoryStatus } from '../../database/entities/success-story.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SuccessStoriesService {
    constructor(
        @InjectRepository(SuccessStory)
        private readonly storyRepository: Repository<SuccessStory>,
    ) { }

    async submitStory(
        userId: string,
        dto: { story: string; title?: string; partnerId?: string; isAnonymous?: boolean; showNames?: boolean; showPhoto?: boolean },
    ): Promise<SuccessStory> {
        const story = this.storyRepository.create({
            userId,
            story: dto.story,
            title: dto.title,
            partnerId: dto.partnerId,
            isAnonymous: dto.isAnonymous ?? false,
            showNames: dto.showNames ?? true,
            showPhoto: dto.showPhoto ?? false,
            status: SuccessStoryStatus.PENDING,
        });
        return this.storyRepository.save(story);
    }

    async getApprovedStories(pagination: PaginationDto) {
        const [stories, total] = await this.storyRepository.findAndCount({
            where: { status: SuccessStoryStatus.APPROVED },
            relations: ['user', 'partner'],
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
        });

        const sanitized = stories.map(s => ({
            id: s.id,
            title: s.title,
            story: s.story,
            photoUrl: s.photoUrl,
            likes: s.likes,
            createdAt: s.createdAt,
            user: s.isAnonymous ? null : (s.showNames ? {
                firstName: s.user?.firstName,
                lastName: s.user?.lastName,
            } : null),
            partner: s.isAnonymous ? null : (s.showNames && s.partner ? {
                firstName: s.partner?.firstName,
                lastName: s.partner?.lastName,
            } : null),
        }));

        return { stories: sanitized, total, page: pagination.page, limit: pagination.limit };
    }

    async likeStory(storyId: string): Promise<void> {
        await this.storyRepository.increment({ id: storyId, status: SuccessStoryStatus.APPROVED }, 'likes', 1);
    }

    async getMyStories(userId: string) {
        return this.storyRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    // ─── ADMIN ───────────────────────────────────────────────

    async getPendingStories(pagination: PaginationDto) {
        const [stories, total] = await this.storyRepository.findAndCount({
            where: { status: SuccessStoryStatus.PENDING },
            relations: ['user', 'partner'],
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.limit,
        });
        return { stories, total, page: pagination.page, limit: pagination.limit };
    }

    async moderateStory(storyId: string, status: SuccessStoryStatus, moderatorNote?: string): Promise<SuccessStory> {
        const story = await this.storyRepository.findOne({ where: { id: storyId } });
        if (!story) throw new NotFoundException('Story not found');

        story.status = status;
        if (moderatorNote) story.moderatorNote = moderatorNote;
        return this.storyRepository.save(story);
    }
}
