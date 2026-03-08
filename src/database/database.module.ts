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
                } else if (dbHost?.includes('.supabase.co')) {
                    const poolerUrl = `postgresql://${configService.get<string>('database.username')}.hjojxhcuokbflvemztji:${configService.get<string>('database.password')}@aws-0-eu-west-1.pooler.supabase.com:6543/${configService.get<string>('database.name')}?pgbouncer=true`;
                    dbLogger.log(`Auto-rewriting Supabase direct host to pooler (aws-0-eu-west-1.pooler.supabase.com:6543)`);
                    connectionConfig = { url: poolerUrl };
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
                    ssl: configService.get<boolean>('database.ssl')
                        ? { rejectUnauthorized: false }
                        : false,
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
