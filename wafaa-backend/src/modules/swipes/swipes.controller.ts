import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SwipesService } from './swipes.service';
import { CreateSwipeDto } from './dto/swipe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('swipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('swipes')
export class SwipesController {
    constructor(private readonly swipesService: SwipesService) { }

    @Post()
    @ApiOperation({ summary: 'Swipe on a user (like or pass)' })
    async swipe(
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateSwipeDto,
    ) {
        return this.swipesService.swipe(userId, dto);
    }
}
