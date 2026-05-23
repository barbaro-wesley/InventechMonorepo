import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { AccessoriesService } from './accessories.service'
import { AssignmentsService } from './assignments/assignments.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

/**
 * Endpoints aninhados em /equipment/:id para o domínio de acessórios.
 * Mantem a rota no namespace do equipamento conforme o checklist:
 *   GET /equipment/:id/accessories
 *   GET /equipment/:id/accessories/assignments
 */
@ApiTags('Equipment Accessories')
@Controller('equipment/:equipmentId')
export class EquipmentAccessoriesController {
    constructor(
        private readonly accessoriesService: AccessoriesService,
        private readonly assignmentsService: AssignmentsService,
    ) { }

    @Get('accessories')
    @Permission('accessories:read')
    @ApiOperation({ summary: 'Listar acessórios atualmente vinculados a um equipamento' })
    findByEquipment(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.accessoriesService.findByEquipment(equipmentId, cu.companyId!)
    }

    @Get('accessories/assignments')
    @Permission('accessory_assignments:read')
    @ApiOperation({ summary: 'Histórico de vínculos de acessórios em um equipamento' })
    findAssignments(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.assignmentsService.findByEquipment(equipmentId, cu.companyId!)
    }
}
