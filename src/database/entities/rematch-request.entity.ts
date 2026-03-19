import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { User } from './user.entity';

export enum RematchStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    EXPIRED = 'expired',
}

@Entity('rematch_requests')
@Unique(['requesterId', 'targetId'])
export class RematchRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    requesterId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requesterId' })
    requester: User;

    @Index()
    @Column()
    targetId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'targetId' })
    target: User;

    @Column({ type: 'enum', enum: RematchStatus, default: RematchStatus.PENDING })
    status: RematchStatus;

    @Column({ nullable: true, length: 300 })
    message: string;

    @Column({ nullable: true })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
