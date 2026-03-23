import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../../database/entities/user.entity';
import { Report } from '../../database/entities/report.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Match } from '../../database/entities/match.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { Photo } from '../../database/entities/photo.entity';
import { Like } from '../../database/entities/like.entity';
import { Message } from '../../database/entities/message.entity';
import { Boost } from '../../database/entities/boost.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Conversation } from '../../database/entities/conversation.entity';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { Ad } from '../../database/entities/ad.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { Plan } from '../../database/entities/plan.entity';

@Module({
    imports: [TypeOrmModule.forFeature([
        User, Report, Profile, Match, Subscription, Photo, Like, Message,
        Boost, Notification, Conversation, SupportTicket, Ad, BlockedUser, Plan
    ])],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
