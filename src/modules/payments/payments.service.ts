import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../../database/entities/subscription.entity';
import { User } from '../../database/entities/user.entity';

export enum PaymentProvider {
    STRIPE = 'stripe',
    APPLE_PAY = 'apple_pay',
    GOOGLE_PAY = 'google_pay',
}

export enum PaymentStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
}

export interface CreatePaymentIntentDto {
    plan: SubscriptionPlan;
    provider: PaymentProvider;
    currency?: string;
}

export interface PaymentResult {
    success: boolean;
    paymentId?: string;
    clientSecret?: string;
    error?: string;
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    private readonly PLAN_PRICES: Record<SubscriptionPlan, number> = {
        [SubscriptionPlan.FREE]: 0,
        [SubscriptionPlan.PREMIUM]: 1499, // $14.99 in cents
        [SubscriptionPlan.GOLD]: 2999,    // $29.99 in cents
    };

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    // ─── CREATE PAYMENT INTENT ───────────────────────────────

    async createPaymentIntent(
        userId: string,
        dto: CreatePaymentIntentDto,
    ): Promise<PaymentResult> {
        const { plan, provider, currency = 'usd' } = dto;

        if (plan === SubscriptionPlan.FREE) {
            throw new BadRequestException('Cannot create payment for free plan');
        }

        const amount = this.PLAN_PRICES[plan];
        if (!amount) {
            throw new BadRequestException('Invalid plan');
        }

        switch (provider) {
            case PaymentProvider.STRIPE:
                return this.createStripePaymentIntent(userId, amount, currency, plan);
            case PaymentProvider.APPLE_PAY:
                return this.createApplePaySession(userId, amount, currency, plan);
            case PaymentProvider.GOOGLE_PAY:
                return this.createGooglePaySession(userId, amount, currency, plan);
            default:
                throw new BadRequestException('Unsupported payment provider');
        }
    }

    // ─── STRIPE INTEGRATION ─────────────────────────────────

    private async createStripePaymentIntent(
        userId: string,
        amount: number,
        currency: string,
        plan: SubscriptionPlan,
    ): Promise<PaymentResult> {
        const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');

        if (!stripeKey) {
            this.logger.warn('Stripe secret key not configured — returning mock payment intent');
            return {
                success: true,
                paymentId: `mock_pi_${Date.now()}`,
                clientSecret: `mock_secret_${Date.now()}`,
            };
        }

        try {
            // TODO: Replace with actual Stripe SDK call
            // const stripe = new Stripe(stripeKey);
            // const paymentIntent = await stripe.paymentIntents.create({
            //     amount,
            //     currency,
            //     metadata: { userId, plan },
            // });
            // return {
            //     success: true,
            //     paymentId: paymentIntent.id,
            //     clientSecret: paymentIntent.client_secret,
            // };

            this.logger.log(`Stripe payment intent created for user ${userId}, plan: ${plan}, amount: ${amount}`);
            return {
                success: true,
                paymentId: `pi_${Date.now()}`,
                clientSecret: `secret_${Date.now()}`,
            };
        } catch (error) {
            this.logger.error('Stripe payment intent creation failed', (error as Error).message);
            return { success: false, error: (error as Error).message };
        }
    }

    // ─── APPLE PAY INTEGRATION ──────────────────────────────

    private async createApplePaySession(
        userId: string,
        amount: number,
        currency: string,
        plan: SubscriptionPlan,
    ): Promise<PaymentResult> {
        // TODO: Integrate with Apple Pay server-side validation
        this.logger.log(`Apple Pay session requested for user ${userId}, plan: ${plan}`);
        return {
            success: true,
            paymentId: `apple_${Date.now()}`,
            clientSecret: `apple_session_${Date.now()}`,
        };
    }

    // ─── GOOGLE PAY INTEGRATION ─────────────────────────────

    private async createGooglePaySession(
        userId: string,
        amount: number,
        currency: string,
        plan: SubscriptionPlan,
    ): Promise<PaymentResult> {
        // TODO: Integrate with Google Pay server-side validation
        this.logger.log(`Google Pay session requested for user ${userId}, plan: ${plan}`);
        return {
            success: true,
            paymentId: `google_${Date.now()}`,
            clientSecret: `google_session_${Date.now()}`,
        };
    }

    // ─── WEBHOOK HANDLER (Stripe) ────────────────────────────

    async handleStripeWebhook(payload: any, signature: string): Promise<void> {
        const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

        // TODO: Verify webhook signature with Stripe SDK
        // const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);

        const event = payload; // Placeholder until Stripe SDK is integrated

        switch (event.type) {
            case 'payment_intent.succeeded':
                await this.handlePaymentSuccess(event.data?.object);
                break;
            case 'payment_intent.payment_failed':
                await this.handlePaymentFailure(event.data?.object);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionCancelled(event.data?.object);
                break;
            default:
                this.logger.log(`Unhandled Stripe event: ${event.type}`);
        }
    }

    private async handlePaymentSuccess(paymentIntent: any): Promise<void> {
        const userId = paymentIntent?.metadata?.userId;
        const plan = paymentIntent?.metadata?.plan as SubscriptionPlan;

        if (!userId || !plan) {
            this.logger.warn('Payment success webhook missing metadata');
            return;
        }

        // Activate subscription
        let subscription = await this.subscriptionRepository.findOne({ where: { userId } });
        if (subscription) {
            subscription.plan = plan;
            subscription.status = SubscriptionStatus.ACTIVE;
            subscription.startDate = new Date();
            subscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            subscription.paymentReference = paymentIntent.id;
        } else {
            subscription = this.subscriptionRepository.create({
                userId,
                plan,
                status: SubscriptionStatus.ACTIVE,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                paymentReference: paymentIntent.id,
            });
        }
        await this.subscriptionRepository.save(subscription);

        this.logger.log(`Subscription activated for user ${userId}: ${plan}`);
    }

    private async handlePaymentFailure(paymentIntent: any): Promise<void> {
        const userId = paymentIntent?.metadata?.userId;
        this.logger.warn(`Payment failed for user ${userId}`);
    }

    private async handleSubscriptionCancelled(subscription: any): Promise<void> {
        const userId = subscription?.metadata?.userId;
        if (!userId) return;

        await this.subscriptionRepository.update(
            { userId },
            { status: SubscriptionStatus.CANCELLED },
        );
        this.logger.log(`Subscription cancelled for user ${userId}`);
    }

    // ─── PRICING INFO ────────────────────────────────────────

    getPricing() {
        return {
            plans: [
                {
                    name: 'Free',
                    plan: SubscriptionPlan.FREE,
                    price: 0,
                    currency: 'usd',
                    features: ['10 daily swipes', 'Basic matching', 'Chat after match'],
                },
                {
                    name: 'Premium',
                    plan: SubscriptionPlan.PREMIUM,
                    price: 14.99,
                    currency: 'usd',
                    features: [
                        'Unlimited swipes', 'See who liked you', 'Super likes',
                        'Rewind', 'Advanced filters', 'Read receipts',
                        'Compliment credits', 'Rematch', 'Passport mode',
                    ],
                },
                {
                    name: 'Elite',
                    plan: SubscriptionPlan.GOLD,
                    price: 29.99,
                    currency: 'usd',
                    features: [
                        'All Premium features', 'Profile boost', 'Invisible mode',
                        'Hide ads', 'Premium badge', 'Priority support',
                    ],
                },
            ],
            providers: Object.values(PaymentProvider),
        };
    }
}
