import {
    Controller,
    Get,
    Delete,
    Patch,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ModerationGuard } from '../../common/guards/moderation.guard';

@ApiTags('matches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModerationGuard)
@Controller('matches')
export class MatchesController {
    constructor(private readonly matchesService: MatchesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all matches' })
    async getMatches(
        @CurrentUser('sub') userId: string,
        @Query() pagination: PaginationDto,
    ) {
        return this.matchesService.getMatches(userId, pagination);
    }

    @Get('unseen')
    @ApiOperation({ summary: 'Get matches the current user has not yet seen' })
    async getUnseenMatches(@CurrentUser('sub') userId: string) {
        return this.matchesService.getUnseenMatches(userId);
    }

    @Patch(':id/seen')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a match as seen by the current user' })
    async markMatchSeen(
        @CurrentUser('sub') userId: string,
        @Param('id') matchId: string,
    ) {
        return this.matchesService.markMatchSeen(userId, matchId);
    }

    @Get('suggestions')
    @ApiOperation({ summary: 'Get profile suggestions for swiping' })
    async getSuggestions(
        @CurrentUser('sub') userId: string,
        @Query('limit') limit?: number,
    ) {
        return this.matchesService.getSuggestions(userId, limit || 20);
    }

    @Get('nearby')
    @ApiOperation({ summary: 'Get nearby users (radar)' })
    async getNearbyUsers(
        @CurrentUser('sub') userId: string,
        @Query('radius') radius?: number,
        @Query('limit') limit?: number,
        @Query('country') country?: string,
        @Query('city') city?: string,
    ) {
        return this.matchesService.getNearbyUsers(userId, radius || 50, limit || 30, country, city);
    }

    @Get('discover')
    @ApiOperation({ summary: 'Get discovery categories (nearby, compatible, new)' })
    async getDiscoveryCategories(@CurrentUser('sub') userId: string) {
        return this.matchesService.getDiscoveryCategories(userId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unmatch a user' })
    async unmatch(
        @CurrentUser('sub') userId: string,
        @Param('id') matchId: string,
    ) {
        return this.matchesService.unmatch(userId, matchId);
    }
}
