import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuccessStory } from '../../database/entities/success-story.entity';
import { SuccessStoriesService } from './success-stories.service';
import { SuccessStoriesController } from './success-stories.controller';

@Module({
    imports: [TypeOrmModule.forFeature([SuccessStory])],
    controllers: [SuccessStoriesController],
    providers: [SuccessStoriesService],
    exports: [SuccessStoriesService],
})
export class SuccessStoriesModule { }
