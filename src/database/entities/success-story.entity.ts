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

export enum SuccessStoryStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Entity('success_stories')
export class SuccessStory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ nullable: true })
    partnerId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'partnerId' })
    partner: User;

    @Column({ type: 'text' })
    story: string;

    @Column({ nullable: true })
    title: string;

    @Column({ nullable: true })
    photoUrl: string;

    @Column({ type: 'enum', enum: SuccessStoryStatus, default: SuccessStoryStatus.PENDING })
    status: SuccessStoryStatus;

    @Column({ default: false })
    isAnonymous: boolean;

    @Column({ default: true })
    showNames: boolean;

    @Column({ default: false })
    showPhoto: boolean;

    @Column({ nullable: true })
    moderatorNote: string;

    @Column({ type: 'int', default: 0 })
    likes: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
