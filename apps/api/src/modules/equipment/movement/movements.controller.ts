import {
    Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { MovementsService } from './movements.service'
import { CreateMovementDto, ReturnMovementDto } from './dto/movement.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@Controller('clients/:clientId/equipment/:equipmentId/movements')
export class MovementsController {
    constructor(private readonly movementsService: MovementsService) { }

    @Get()
    @Permission('movement:list')
    findAll(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.findAll(equipmentId, clientId, cu.companyId!)
    }

    @Post()
    @Permission('movement:create')
    create(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Body() dto: CreateMovementDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.create(equipmentId, dto, clientId, cu.companyId!, cu)
    }

    @Post(':id/return')
    @HttpCode(HttpStatus.OK)
    @Permission('movement:return')
    returnEquipment(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReturnMovementDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.returnEquipment(id, dto, cu.companyId!, cu)
    }
}
