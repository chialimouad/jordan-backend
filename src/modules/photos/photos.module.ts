import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { CloudinaryService } from './cloudinary.service';
import { Photo } from '../../database/entities/photo.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Photo])],
    controllers: [PhotosController],
    providers: [PhotosService, CloudinaryService],
    exports: [PhotosService, CloudinaryService],
})
export class PhotosModule { }
