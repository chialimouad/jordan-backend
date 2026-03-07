import { IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SwipeAction {
    LIKE = 'like',
    PASS = 'pass',
}

export class CreateSwipeDto {
    @ApiProperty({ description: 'Target user ID' })
    @IsUUID()
    targetUserId: string;

    @ApiProperty({ enum: SwipeAction })
    @IsEnum(SwipeAction)
    action: SwipeAction;
}
