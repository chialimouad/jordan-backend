import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter;
    private readonly fromAddress: string;
    private smtpReady = false;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get<string>('mail.host');
        const port = this.configService.get<number>('mail.port');
        const user = this.configService.get<string>('mail.user');
        const pass = this.configService.get<string>('mail.pass');
        this.fromAddress = `Methna App <${this.configService.get<string>('mail.from') || user}>`;

        this.logger.log(`[SMTP] Configuring: host=${host}, port=${port}, user=${user ? user : '✗ MISSING'}, pass=${pass ? '✓ SET' : '✗ MISSING'}`);

        if (!user || !pass) {
            this.logger.error('❌ [SMTP] MAIL_USER or MAIL_PASS is NOT set — OTP emails WILL FAIL');
        }

        this.transporter = nodemailer.createTransport({
            host: host || 'smtp.gmail.com',
            port: port || 587,
            secure: (port || 587) === 465,
            auth: { user, pass },
            // Connection timeout settings
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        });

        // Verify SMTP connection on startup
        this.transporter.verify()
            .then(() => {
                this.smtpReady = true;
                this.logger.log('✅ [SMTP] Connection verified — ready to send emails');
            })
            .catch((err) => {
                this.smtpReady = false;
                this.logger.error(`❌ [SMTP] Connection FAILED: ${err?.message || err}`);
                this.logger.error(`❌ [SMTP] Check MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS env vars`);
            });
    }

    async sendOtpEmail(to: string, otp: string, name: string): Promise<void> {
        this.logger.log(`[OTP-MAIL] Sending verification OTP to ${to} (name=${name})`);

        if (!this.smtpReady) {
            this.logger.warn('[OTP-MAIL] SMTP not verified yet — attempting send anyway...');
        }

        const info = await this.transporter.sendMail({
            from: this.fromAddress,
            to,
            subject: 'Methna - Email Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2d7a4f;">Assalamu Alaikum ${name},</h2>
                    <p>Your verification code is:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <h1 style="color: #2d7a4f; letter-spacing: 8px; font-size: 36px; margin: 0;">${otp}</h1>
                    </div>
                    <p>This code expires in <strong>5 minutes</strong>.</p>
                    <p>If you did not request this code, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Methna - Halal Matchmaking Platform</p>
                </div>
            `,
        });

        this.logger.log(`✅ [OTP-MAIL] Verification email sent to ${to} — messageId=${info.messageId}, response=${info.response}`);
    }

    async sendPasswordResetOtp(to: string, otp: string, name: string): Promise<void> {
        this.logger.log(`[OTP-MAIL] Sending password reset OTP to ${to} (name=${name})`);

        if (!this.smtpReady) {
            this.logger.warn('[OTP-MAIL] SMTP not verified yet — attempting send anyway...');
        }

        const info = await this.transporter.sendMail({
            from: this.fromAddress,
            to,
            subject: 'Methna - Password Reset Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2d7a4f;">Assalamu Alaikum ${name},</h2>
                    <p>Your password reset code is:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <h1 style="color: #c0392b; letter-spacing: 8px; font-size: 36px; margin: 0;">${otp}</h1>
                    </div>
                    <p>This code expires in <strong>5 minutes</strong>.</p>
                    <p>If you did not request this, please secure your account immediately.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Methna - Halal Matchmaking Platform</p>
                </div>
            `,
        });

        this.logger.log(`✅ [OTP-MAIL] Reset email sent to ${to} — messageId=${info.messageId}, response=${info.response}`);
    }
}
