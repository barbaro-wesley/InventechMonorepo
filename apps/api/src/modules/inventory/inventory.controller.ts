import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common'
import { InventoryService } from './inventory.service'
import { CreateStockItemDto, ListStockItemsDto, UpdateStockItemDto } from './dto/stock-item.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { Permission } from '../../common/decorators/permission.decorator'

@Controller('inventory')
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) {}

    @Get()
    @Permission('inventory:list')
    findAll(@Query() filters: ListStockItemsDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.inventoryService.findAll(cu.companyId!, filters)
    }

    @Get(':id')
    @Permission('inventory:read')
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.inventoryService.findOne(id, cu.companyId!)
    }

    @Post()
    @Permission('inventory:create')
    create(@Body() dto: CreateStockItemDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.inventoryService.create(dto, cu.companyId!)
    }

    @Patch(':id')
    @Permission('inventory:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateStockItemDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.inventoryService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('inventory:delete')
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.inventoryService.remove(id, cu.companyId!)
    }
}
