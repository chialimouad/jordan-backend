import {
    IsOptional,
    IsEnum,
    IsInt,
    IsString,
    Min,
    Max,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, MaritalStatus, ReligiousLevel } from '../../../database/entities/profile.entity';

export class SearchFiltersDto {
    @ApiPropertyOptional({ minimum: 18 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(18)
    minAge?: number;

    @ApiPropertyOptional({ maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Max(100)
    maxAge?: number;

    @ApiPropertyOptional({ enum: Gender })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({ enum: MaritalStatus })
    @IsOptional()
    @IsEnum(MaritalStatus)
    maritalStatus?: MaritalStatus;

    @ApiPropertyOptional({ enum: ReligiousLevel })
    @IsOptional()
    @IsEnum(ReligiousLevel)
    religiousLevel?: ReligiousLevel;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    ethnicity?: string;

    @ApiPropertyOptional({ description: 'Search text in bio' })
    @IsOptional()
    @IsString()
    q?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 20;
}
