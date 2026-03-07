import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Post()
    @ApiOperation({ summary: 'Report a user' })
    async createReport(
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateReportDto,
    ) {
        return this.reportsService.createReport(userId, dto);
    }

    @Post('block/:id')
    @ApiOperation({ summary: 'Block a user' })
    async blockUser(
        @CurrentUser('sub') userId: string,
        @Param('id') blockedId: string,
    ) {
        return this.reportsService.blockUser(userId, blockedId);
    }

    @Delete('block/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unblock a user' })
    async unblockUser(
        @CurrentUser('sub') userId: string,
        @Param('id') blockedId: string,
    ) {
        return this.reportsService.unblockUser(userId, blockedId);
    }

    @Get('blocked')
    @ApiOperation({ summary: 'Get blocked users list' })
    async getBlockedUsers(@CurrentUser('sub') userId: string) {
        return this.reportsService.getBlockedUsers(userId);
    }
}
