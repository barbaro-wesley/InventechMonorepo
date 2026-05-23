import {
    Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { AssignmentsService } from './assignments.service'
import { AssignAccessoryDto, UnassignAccessoryDto } from './dto/assignment.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@ApiTags('Accessory Assignments')
@Controller('accessories/:accessoryId/assignments')
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) { }

    @Get()
    @Permission('accessory_assignments:read')
    @ApiOperation({ summary: 'Histórico de vínculos do acessório' })
    findByAccessory(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.assignmentsService.findByAccessory(accessoryId, cu.companyId!)
    }

    @Post('assign')
    @Permission('accessory_assignments:assign')
    @ApiOperation({ summary: 'Vincular acessório a um equipamento' })
    assign(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @Body() dto: AssignAccessoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.assignmentsService.assign(accessoryId, dto, cu.companyId!, cu)
    }

    @Post('unassign')
    @HttpCode(HttpStatus.OK)
    @Permission('accessory_assignments:unassign')
    @ApiOperation({ summary: 'Desvincular acessório do equipamento atual' })
    unassign(
        @Param('accessoryId', ParseUUIDPipe) accessoryId: string,
        @Body() dto: UnassignAccessoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.assignmentsService.unassign(accessoryId, dto, cu.companyId!, cu)
    }
}
