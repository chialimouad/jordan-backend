import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('photos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('photos')
export class PhotosController {
    constructor(private readonly photosService: PhotosService) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('photo'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                photo: { type: 'string', format: 'binary' },
            },
        },
    })
    @ApiOperation({ summary: 'Upload a profile photo' })
    async uploadPhoto(
        @CurrentUser('sub') userId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.photosService.uploadPhoto(userId, file);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get all my photos' })
    async getMyPhotos(@CurrentUser('sub') userId: string) {
        return this.photosService.getMyPhotos(userId);
    }

    @Patch(':id/main')
    @ApiOperation({ summary: 'Set photo as main profile photo' })
    async setMainPhoto(
        @CurrentUser('sub') userId: string,
        @Param('id') photoId: string,
    ) {
        return this.photosService.setMainPhoto(userId, photoId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a photo' })
    async deletePhoto(
        @CurrentUser('sub') userId: string,
        @Param('id') photoId: string,
    ) {
        return this.photosService.deletePhoto(userId, photoId);
    }
}
