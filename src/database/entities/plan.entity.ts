import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Subscription } from './subscription.entity';
import { FeatureFlag } from '../../modules/monetization/monetization.service';

@Entity('plans')
export class Plan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string; // 'BASIC', 'GOLD', 'PLATINUM'

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    price: number;
    
    @Column({ nullable: true })
    stripePriceId: string; // Optional reference to external gateway

    @Column({ default: 30 })
    durationDays: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'jsonb', default: [] })
    features: FeatureFlag[];

    // Limits configuration
    @Column({ type: 'int', default: 10 })
    dailyLikesLimit: number; // -1 for unlimited

    @Column({ type: 'int', default: 0 })
    dailySuperLikesLimit: number;

    @Column({ type: 'int', default: 0 })
    dailyComplimentsLimit: number;

    @Column({ type: 'int', default: 2 })
    monthlyRewindsLimit: number;

    @Column({ type: 'int', default: 0 })
    weeklyBoostsLimit: number;

    @OneToMany(() => Subscription, sub => sub.planEntity)
    subscriptions: Subscription[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
