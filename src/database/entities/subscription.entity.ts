import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';
import { Plan } from './plan.entity';

export enum SubscriptionPlan {
    FREE = 'free',
    PREMIUM = 'premium',
    GOLD = 'gold',
}

/** UI alias — use SubscriptionPlan.GOLD in code, display "Elite" in the frontend */
export const ELITE_PLAN = SubscriptionPlan.GOLD;

export enum SubscriptionStatus {
    ACTIVE = 'active',
    CANCELLED = 'cancelled',
    EXPIRED = 'expired',
}

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Plan, plan => plan.subscriptions, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'planId' })
    planEntity: Plan;

    @Column({ nullable: true })
    planId: string;

    @Column({ type: 'enum', enum: SubscriptionPlan, default: SubscriptionPlan.FREE })
    plan: SubscriptionPlan;

    @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
    status: SubscriptionStatus;

    @Column({ nullable: true })
    startDate: Date;

    @Column({ nullable: true })
    endDate: Date;

    @Column({ nullable: true })
    paymentReference: string;

    // Stripe Subscription ID
    @Column({ nullable: true })
    stripeSubscriptionId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
