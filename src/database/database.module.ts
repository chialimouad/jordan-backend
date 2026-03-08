import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

const dbLogger = new Logger('DatabaseModule');

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const databaseUrl = configService.get<string>('database.url');
                const dbHost = configService.get<string>('database.host');

                let connectionConfig: any;

                if (databaseUrl) {
                    dbLogger.log(`Using DATABASE_URL (host: ${new URL(databaseUrl).hostname})`);
                    connectionConfig = { url: databaseUrl };
                } else {
                    dbLogger.log(`Using individual DB vars (host: ${dbHost})`);
                    connectionConfig = {
                        host: dbHost,
                        port: configService.get<number>('database.port'),
                        username: configService.get<string>('database.username'),
                        password: configService.get<string>('database.password'),
                        database: configService.get<string>('database.name'),
                    };
                }

                return {
                    type: 'postgres',
                    ...connectionConfig,
                    ssl: { rejectUnauthorized: false },
                    autoLoadEntities: true,
                    synchronize: process.env.NODE_ENV !== 'production',
                    logging: process.env.NODE_ENV === 'development',
                    entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],
                    retryAttempts: 3,
                    retryDelay: 3000,
                };
            },
        }),
    ],
})
export class DatabaseModule { }
