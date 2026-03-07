import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserStatus } from '../../database/entities/user.entity';
import { ReportStatus } from '../../database/entities/report.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UpdateUserStatusDto {
    @ApiProperty({ enum: UserStatus })
    @IsEnum(UserStatus)
    status: UserStatus;
}

class ResolveReportDto {
    @ApiProperty({ enum: ReportStatus })
    @IsEnum(ReportStatus)
    status: ReportStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    moderatorNote?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    @ApiOperation({ summary: 'List all users (admin only)' })
    async getUsers(
        @Query() pagination: PaginationDto,
        @Query('status') status?: UserStatus,
    ) {
        return this.adminService.getUsers(pagination, status);
    }

    @Patch('users/:id/status')
    @ApiOperation({ summary: 'Update user status (ban/suspend/activate)' })
    async updateUserStatus(
        @Param('id') userId: string,
        @Body() dto: UpdateUserStatusDto,
    ) {
        return this.adminService.updateUserStatus(userId, dto.status);
    }

    @Get('reports')
    @ApiOperation({ summary: 'List all reports (admin only)' })
    async getReports(
        @Query() pagination: PaginationDto,
        @Query('status') status?: ReportStatus,
    ) {
        return this.adminService.getReports(pagination, status);
    }

    @Patch('reports/:id')
    @ApiOperation({ summary: 'Resolve a report' })
    async resolveReport(
        @CurrentUser('sub') adminId: string,
        @Param('id') reportId: string,
        @Body() dto: ResolveReportDto,
    ) {
        return this.adminService.resolveReport(
            reportId,
            adminId,
            dto.status,
            dto.moderatorNote,
        );
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get dashboard statistics' })
    async getDashboardStats() {
        return this.adminService.getDashboardStats();
    }
}
