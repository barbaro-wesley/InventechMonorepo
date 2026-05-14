import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common'
import { MovementsService } from './movements.service'
import { CreateStockMovementDto, ListStockMovementsDto } from '../dto/stock-movement.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { Permission } from '../../../common/decorators/permission.decorator'

@Controller('inventory/movements')
export class MovementsController {
    constructor(private readonly movementsService: MovementsService) {}

    @Get()
    @Permission('inventory:list')
    findAll(@Query() filters: ListStockMovementsDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.movementsService.findAll(cu.companyId!, filters)
    }

    @Get('item/:itemId')
    @Permission('inventory:read')
    findByItem(
        @Param('itemId', ParseUUIDPipe) itemId: string,
        @Query('page', new ParseIntPipe({ optional: true })) page: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit: number,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.findByItem(itemId, cu.companyId!, page, limit)
    }

    @Post()
    @Permission('inventory:update')
    create(@Body() dto: CreateStockMovementDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.movementsService.create(dto, cu.companyId!, cu.sub)
    }
}
