import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Photo } from '../../database/entities/photo.entity';
import { Like } from '../../database/entities/like.entity';
import { Boost } from '../../database/entities/boost.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Profile, Photo, Like, Boost])],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
