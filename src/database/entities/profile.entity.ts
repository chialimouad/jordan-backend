import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';

export enum Gender {
    MALE = 'male',
    FEMALE = 'female',
}

export enum MaritalStatus {
    NEVER_MARRIED = 'never_married',
    DIVORCED = 'divorced',
    WIDOWED = 'widowed',
}

export enum ReligiousLevel {
    VERY_PRACTICING = 'very_practicing',
    PRACTICING = 'practicing',
    MODERATE = 'moderate',
    LIBERAL = 'liberal',
}

@Entity('profiles')
export class Profile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    userId: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ nullable: true, length: 500 })
    bio: string;

    @Index()
    @Column({ type: 'enum', enum: Gender })
    gender: Gender;

    @Index()
    @Column({ type: 'date' })
    dateOfBirth: Date;

    @Column({ type: 'enum', enum: MaritalStatus, default: MaritalStatus.NEVER_MARRIED })
    maritalStatus: MaritalStatus;

    @Column({ type: 'enum', enum: ReligiousLevel, default: ReligiousLevel.PRACTICING })
    religiousLevel: ReligiousLevel;

    @Column({ nullable: true })
    ethnicity: string;

    @Column({ nullable: true })
    nationality: string;

    @Column({ nullable: true })
    education: string;

    @Column({ nullable: true })
    occupation: string;

    @Column({ type: 'int', nullable: true })
    height: number; // in cm

    @Index()
    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true })
    country: string;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    latitude: number;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    longitude: number;

    @Column({ type: 'simple-array', nullable: true })
    interests: string[];

    @Column({ type: 'simple-array', nullable: true })
    languages: string[];

    @Column({ default: false })
    hasChildren: boolean;

    @Column({ type: 'int', default: 0 })
    numberOfChildren: number;

    @Column({ default: false })
    wantsChildren: boolean;

    @Column({ default: false })
    willingToRelocate: boolean;

    @Column({ nullable: true, length: 1000 })
    aboutPartner: string;

    @Column({ type: 'float', default: 0 })
    activityScore: number;

    @Column({ default: false })
    isComplete: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
