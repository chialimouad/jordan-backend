import {
    Controller,
    Get,
    Put,
    Patch,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdatePreferencesDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
    constructor(private readonly profilesService: ProfilesService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get own profile' })
    async getMyProfile(@CurrentUser('sub') userId: string) {
        return this.profilesService.getMyProfile(userId);
    }

    @Put()
    @ApiOperation({ summary: 'Create or update profile' })
    async createOrUpdateProfile(
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateProfileDto,
    ) {
        return this.profilesService.createOrUpdateProfile(userId, dto);
    }

    @Get('preferences')
    @ApiOperation({ summary: 'Get matching preferences' })
    async getPreferences(@CurrentUser('sub') userId: string) {
        return this.profilesService.getPreferences(userId);
    }

    @Patch('preferences')
    @ApiOperation({ summary: 'Update matching preferences' })
    async updatePreferences(
        @CurrentUser('sub') userId: string,
        @Body() dto: UpdatePreferencesDto,
    ) {
        return this.profilesService.updatePreferences(userId, dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get profile by user ID' })
    async getProfile(@Param('id') id: string) {
        return this.profilesService.getProfileById(id);
    }
}
