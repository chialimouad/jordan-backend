import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../../../database/entities/support-ticket.entity';

export class CreateSupportTicketDto {
    @ApiProperty({ description: 'Subject of the support ticket' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(200)
    subject: string;

    @ApiProperty({ description: 'Detailed message' })
    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(2000)
    message: string;
}

export class UpdateTicketStatusDto {
    @ApiProperty({ enum: TicketStatus })
    @IsEnum(TicketStatus)
    status: TicketStatus;

    @ApiPropertyOptional({ description: 'Admin reply to the ticket' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    adminReply?: string;
}

export enum FeedbackType {
    FEEDBACK = 'feedback',
    BUG = 'bug',
    SUGGESTION = 'suggestion',
}

export class CreateFeedbackDto {
    @ApiProperty({ enum: FeedbackType, description: 'Type of feedback' })
    @IsEnum(FeedbackType)
    type: FeedbackType;

    @ApiProperty({ description: 'Feedback message' })
    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(2000)
    message: string;

    @ApiPropertyOptional({ description: 'Contact email (optional)' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    email?: string;
}
