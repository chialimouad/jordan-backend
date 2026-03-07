import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason } from '../../../database/entities/report.entity';

export class CreateReportDto {
    @ApiProperty({ description: 'User ID to report' })
    @IsUUID()
    reportedId: string;

    @ApiProperty({ enum: ReportReason })
    @IsEnum(ReportReason)
    reason: ReportReason;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    details?: string;
}
