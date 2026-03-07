import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionPlan } from '../../database/entities/subscription.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateSubscriptionDto {
    @ApiProperty({ enum: SubscriptionPlan })
    @IsEnum(SubscriptionPlan)
    plan: SubscriptionPlan;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    paymentReference?: string;
}

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
    constructor(private readonly subscriptionsService: SubscriptionsService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current subscription' })
    async getMySubscription(@CurrentUser('sub') userId: string) {
        return this.subscriptionsService.getMySubscription(userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create or upgrade subscription' })
    async createSubscription(
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateSubscriptionDto,
    ) {
        return this.subscriptionsService.createSubscription(
            userId,
            dto.plan,
            dto.paymentReference,
        );
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Cancel subscription' })
    async cancelSubscription(@CurrentUser('sub') userId: string) {
        return this.subscriptionsService.cancelSubscription(userId);
    }

    @Get('plans')
    @ApiOperation({ summary: 'Get all plan features' })
    async getPlans() {
        const plans = await Promise.all(
            Object.values(SubscriptionPlan).map(async (plan) => ({
                plan,
                features: await this.subscriptionsService.getPlanFeatures(plan),
            })),
        );
        return plans;
    }
}
