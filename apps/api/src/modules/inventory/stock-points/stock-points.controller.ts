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
    Put,
    Query,
} from '@nestjs/common'
import { StockPointsService } from './stock-points.service'
import {
    AssignClientsDto,
    CreateStockPointDto,
    ListStockPointsDto,
    UpdateStockPointDto,
} from './dto/stock-point.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { Permission } from '../../../common/decorators/permission.decorator'

@Controller('inventory/points')
export class StockPointsController {
    constructor(private readonly stockPointsService: StockPointsService) {}

    @Get()
    @Permission('inventory-point:list')
    findAll(@Query() filters: ListStockPointsDto, @CurrentUser() cu: AuthenticatedUser) {
        // CLIENT_ADMIN users see only stock points linked to their client
        const effectiveFilters = cu.clientId
            ? { ...filters, clientId: cu.clientId }
            : filters
        return this.stockPointsService.findAll(cu.companyId!, effectiveFilters)
    }

    @Get(':id')
    @Permission('inventory-point:read')
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.stockPointsService.findOne(id, cu.companyId!, cu.clientId ?? undefined)
    }

    @Post()
    @Permission('inventory-point:create')
    create(@Body() dto: CreateStockPointDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.stockPointsService.create(dto, cu.companyId!)
    }

    @Patch(':id')
    @Permission('inventory-point:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateStockPointDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.stockPointsService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('inventory-point:delete')
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.stockPointsService.remove(id, cu.companyId!)
    }

    @Put(':id/clients')
    @Permission('inventory-point:update')
    assignClients(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignClientsDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.stockPointsService.assignClients(id, dto, cu.companyId!)
    }
}
