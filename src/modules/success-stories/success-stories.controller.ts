import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuccessStoriesService } from './success-stories.service';
import { SuccessStoryStatus } from '../../database/entities/success-story.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('success-stories')
@Controller('success-stories')
export class SuccessStoriesController {
    constructor(private readonly storiesService: SuccessStoriesService) { }

    @Get()
    async getApprovedStories(@Query() pagination: PaginationDto) {
        return this.storiesService.getApprovedStories(pagination);
    }

    @Post(':id/like')
    async likeStory(@Param('id') id: string) {
        await this.storiesService.likeStory(id);
        return { liked: true };
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                story: { type: 'string' },
                title: { type: 'string' },
                partnerId: { type: 'string' },
                isAnonymous: { type: 'boolean' },
                showNames: { type: 'boolean' },
                showPhoto: { type: 'boolean' },
            },
            required: ['story'],
        },
    })
    async submitStory(@Request() req, @Body() dto: any) {
        return this.storiesService.submitStory(req.user.id, dto);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('my')
    async getMyStories(@Request() req) {
        return this.storiesService.getMyStories(req.user.id);
    }
}
