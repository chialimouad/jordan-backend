import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';
import { Match } from './match.entity';

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    SYSTEM = 'system',
}

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    matchId: string;

    @ManyToOne(() => Match, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'matchId' })
    match: Match;

    @Index()
    @Column()
    senderId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'senderId' })
    sender: User;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
    type: MessageType;

    @Column({ nullable: true })
    readAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
