import {
    IsString,
    IsOptional,
    IsEnum,
    IsDateString,
    IsNumber,
    IsBoolean,
    IsArray,
    MaxLength,
    Min,
    Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, MaritalStatus, ReligiousLevel } from '../../../database/entities/profile.entity';

export class CreateProfileDto {
    @ApiProperty({ enum: Gender })
    @IsEnum(Gender)
    gender: Gender;

    @ApiProperty({ example: '1995-06-15' })
    @IsDateString()
    dateOfBirth: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;

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

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    nationality?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    education?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    occupation?: string;

    @ApiPropertyOptional({ description: 'Height in cm' })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(250)
    height?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    interests?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    languages?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    hasChildren?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    numberOfChildren?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    wantsChildren?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    willingToRelocate?: boolean;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    aboutPartner?: string;
}

export class UpdateProfileDto extends CreateProfileDto { }

export class UpdatePreferencesDto {
    @ApiPropertyOptional({ default: 18, minimum: 18 })
    @IsOptional()
    @IsNumber()
    @Min(18)
    minAge?: number;

    @ApiPropertyOptional({ default: 60 })
    @IsOptional()
    @IsNumber()
    @Max(100)
    maxAge?: number;

    @ApiPropertyOptional({ enum: Gender })
    @IsOptional()
    @IsEnum(Gender)
    preferredGender?: Gender;

    @ApiPropertyOptional({ description: 'Maximum distance in km', default: 100 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(500)
    maxDistance?: number;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    preferredEthnicities?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    preferredNationalities?: string[];

    @ApiPropertyOptional({ enum: ReligiousLevel })
    @IsOptional()
    @IsEnum(ReligiousLevel)
    preferredReligiousLevel?: ReligiousLevel;

    @ApiPropertyOptional({ enum: MaritalStatus })
    @IsOptional()
    @IsEnum(MaritalStatus)
    preferredMaritalStatus?: MaritalStatus;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    preferredInterests?: string[];
}
