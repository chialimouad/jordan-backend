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

@Entity('likes')
@Unique(['likerId', 'likedId'])
@Index(['likerId', 'likedId'])
export class Like {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    likerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'likerId' })
    liker: User;

    @Index()
    @Column()
    likedId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'likedId' })
    liked: User;

    @Column({ default: true })
    isLike: boolean; // true = like, false = pass

    @CreateDateColumn()
    createdAt: Date;
}
