import {
    Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { MaintenancesService } from './maintenances.service'
import { CreateAccessoryMaintenanceDto, CompleteAccessoryMaintenanceDto } from './dto/maintenance.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@ApiTags('Accessory Maintenances')
@Controller('accessories/:accessoryId/maintenances')
export class MaintenancesController {
    constructor(private readonly maintenancesService: MaintenancesService) { }

    @Get()
    @Permission('accessory_maintenances:read')
    @ApiOperation({ summary: 'Histórico de manutenções do acessório' })
    findAll(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenancesService.findAll(accessoryId, cu.companyId!)
    }

    @Get(':id')
    @Permission('accessory_maintenances:read')
    @ApiOperation({ summary: 'Detalhe de uma manutenção' })
    findOne(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenancesService.findOne(id, accessoryId, cu.companyId!)
    }

    @Post()
    @Permission('accessory_maintenances:create')
    @ApiOperation({ summary: 'Registrar manutenção de acessório' })
    create(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @Body() dto: CreateAccessoryMaintenanceDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenancesService.create(accessoryId, dto, cu.companyId!, cu)
    }

    @Post(':id/complete')
    @HttpCode(HttpStatus.OK)
    @Permission('accessory_maintenances:update')
    @ApiOperation({ summary: 'Concluir manutenção de acessório' })
    complete(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CompleteAccessoryMaintenanceDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenancesService.complete(id, accessoryId, dto, cu.companyId!)
    }
}
