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

@Entity('blocked_users')
@Unique(['blockerId', 'blockedId'])
export class BlockedUser {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    blockerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blockerId' })
    blocker: User;

    @Index()
    @Column()
    blockedId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blockedId' })
    blocked: User;

    @CreateDateColumn()
    createdAt: Date;
}
