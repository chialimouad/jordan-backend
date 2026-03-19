import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileView } from '../../database/entities/profile-view.entity';
import { ProfileViewsService } from './profile-views.service';
import { ProfileViewsController } from './profile-views.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedisModule } from '../redis/redis.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ProfileView]),
        NotificationsModule,
        RedisModule,
    ],
    controllers: [ProfileViewsController],
    providers: [ProfileViewsService],
    exports: [ProfileViewsService],
})
export class ProfileViewsModule { }
