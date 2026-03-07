import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user' })
    async getMe(@CurrentUser('sub') userId: string) {
        return this.usersService.getMe(userId);
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update current user account' })
    async updateMe(
        @CurrentUser('sub') userId: string,
        @Body() updateData: any,
    ) {
        return this.usersService.updateMe(userId, updateData);
    }

    @Delete('me')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft delete current user account' })
    async deleteMe(@CurrentUser('sub') userId: string) {
        return this.usersService.softDelete(userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get public profile of a user' })
    async getUser(@Param('id') id: string) {
        return this.usersService.getPublicProfile(id);
    }
}
