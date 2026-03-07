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

@Entity('photos')
export class Photo {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    url: string;

    @Column()
    publicId: string; // Cloudinary public_id

    @Column({ default: false })
    isMain: boolean;

    @Column({ type: 'int', default: 0 })
    order: number;

    @CreateDateColumn()
    createdAt: Date;
}
