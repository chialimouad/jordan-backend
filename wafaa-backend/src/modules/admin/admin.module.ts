import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../../database/entities/user.entity';
import { Report } from '../../database/entities/report.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Match } from '../../database/entities/match.entity';
import { Subscription } from '../../database/entities/subscription.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Report, Profile, Match, Subscription])],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
