import { Controller, Get, Post, Body, Headers, UseGuards, Request, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService, CreatePaymentIntentDto, PaymentProvider } from './payments.service';
import { SubscriptionPlan } from '../../database/entities/subscription.entity';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Get('pricing')
    getPricing() {
        return this.paymentsService.getPricing();
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('create-intent')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                plan: { type: 'string', enum: Object.values(SubscriptionPlan) },
                provider: { type: 'string', enum: Object.values(PaymentProvider) },
                currency: { type: 'string', default: 'usd' },
            },
            required: ['plan', 'provider'],
        },
    })
    async createPaymentIntent(@Request() req, @Body() dto: CreatePaymentIntentDto) {
        return this.paymentsService.createPaymentIntent(req.user.id, dto);
    }

    @Post('webhook/stripe')
    async stripeWebhook(
        @Body() payload: any,
        @Headers('stripe-signature') signature: string,
    ) {
        await this.paymentsService.handleStripeWebhook(payload, signature);
        return { received: true };
    }
}
