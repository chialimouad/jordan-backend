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

@Entity('profile_views')
@Index(['viewedId', 'createdAt'])
export class ProfileView {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    viewerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'viewerId' })
    viewer: User;

    @Index()
    @Column()
    viewedId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'viewedId' })
    viewed: User;

    @CreateDateColumn()
    createdAt: Date;
}
