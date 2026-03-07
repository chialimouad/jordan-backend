import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../../database/entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) { }

    async register(registerDto: RegisterDto) {
        const { email, password, firstName, lastName, phone } = registerDto;

        // Check if user exists
        const existingUser = await this.userRepository.findOne({
            where: { email },
        });
        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = this.userRepository.create({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
        });

        await this.userRepository.save(user);

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Store refresh token
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        this.logger.log(`User registered: ${email}`);

        return {
            user: this.sanitizeUser(user),
            ...tokens,
        };
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        // Find user with password
        const user = await this.userRepository.findOne({
            where: { email },
            select: [
                'id',
                'email',
                'password',
                'firstName',
                'lastName',
                'role',
                'status',
            ],
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('Account is not active');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Update refresh token & last login
        await this.updateRefreshToken(user.id, tokens.refreshToken);
        await this.userRepository.update(user.id, { lastLoginAt: new Date() });

        this.logger.log(`User logged in: ${email}`);

        return {
            user: this.sanitizeUser(user),
            ...tokens,
        };
    }

    async refreshTokens(refreshToken: string) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
            });

            const user = await this.userRepository.findOne({
                where: { id: payload.sub },
                select: ['id', 'email', 'firstName', 'lastName', 'role', 'refreshToken'],
            });

            if (!user || !user.refreshToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Verify stored refresh token matches
            const isRefreshValid = await bcrypt.compare(
                refreshToken,
                user.refreshToken,
            );
            if (!isRefreshValid) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Generate new tokens (rotation)
            const tokens = await this.generateTokens(user);
            await this.updateRefreshToken(user.id, tokens.refreshToken);

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(userId: string) {
        await this.userRepository.update(userId, { refreshToken: undefined });
        await this.redisService.setUserOffline(userId);
    }

    private async generateTokens(user: User) {
        const payload = { sub: user.id, email: user.email, role: user.role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
                expiresIn: this.configService.get<string>('jwt.refreshExpiration'),
            }),
        ]);

        return { accessToken, refreshToken };
    }

    private async updateRefreshToken(userId: string, refreshToken: string) {
        const salt = await bcrypt.genSalt(10);
        const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
        await this.userRepository.update(userId, {
            refreshToken: hashedRefreshToken,
        });
    }

    private sanitizeUser(user: User) {
        const { password, refreshToken, ...sanitized } = user;
        return sanitized;
    }
}
