import {
    Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { AccessoryMovementsService } from './movements.service'
import { CreateAccessoryMovementDto, ReturnAccessoryMovementDto } from './dto/movement.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@ApiTags('Accessory Movements')
@Controller('accessories/:accessoryId/movements')
export class AccessoryMovementsController {
    constructor(private readonly movementsService: AccessoryMovementsService) { }

    @Get()
    @Permission('accessory_movements:read')
    @ApiOperation({ summary: 'Histórico de movimentações do acessório' })
    findAll(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.findAll(accessoryId, cu.companyId!)
    }

    @Post()
    @Permission('accessory_movements:create')
    @ApiOperation({ summary: 'Registrar movimentação do acessório' })
    create(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @Body() dto: CreateAccessoryMovementDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.create(accessoryId, dto, cu.companyId!, cu)
    }

    @Post(':id/return')
    @HttpCode(HttpStatus.OK)
    @Permission('accessory_movements:return')
    @ApiOperation({ summary: 'Devolver empréstimo de acessório' })
    returnAccessory(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReturnAccessoryMovementDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.movementsService.returnAccessory(id, dto, cu.companyId!, cu)
    }
}
