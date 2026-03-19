import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TrustSafetyService } from './trust-safety.service';
import { BackgroundCheckService } from './background-check.service';
import { TrustSafetyController } from './trust-safety.controller';
import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Like } from '../../database/entities/like.entity';
import { Message } from '../../database/entities/message.entity';
import { ContentFlag } from '../../database/entities/content-flag.entity';
import { LoginHistory } from '../../database/entities/login-history.entity';
import { RedisModule } from '../redis/redis.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Profile, Like, Message, ContentFlag, LoginHistory]),
        RedisModule,
        PhotosModule,
        ConfigModule,
    ],
    controllers: [TrustSafetyController],
    providers: [TrustSafetyService, BackgroundCheckService],
    exports: [TrustSafetyService, BackgroundCheckService],
})
export class TrustSafetyModule { }
