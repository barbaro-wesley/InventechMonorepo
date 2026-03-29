import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query, ParseUUIDPipe,
    HttpCode, HttpStatus,
} from '@nestjs/common'
import { MaintenanceGroupsService } from './maintenance-groups.service'
import {
    CreateMaintenanceGroupDto,
    UpdateMaintenanceGroupDto,
    ListMaintenanceGroupsDto,
    AssignTechnicianToGroupDto,
} from './dto/maintenance-group.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('maintenance-groups')
export class MaintenanceGroupsController {
    constructor(private readonly maintenanceGroupsService: MaintenanceGroupsService) { }

    @Get()
    @Permission('maintenance-group:list')
    findAll(@Query() filters: ListMaintenanceGroupsDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.maintenanceGroupsService.findAll(cu.companyId!, filters)
    }

    @Get(':id')
    @Permission('maintenance-group:read')
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.maintenanceGroupsService.findOne(id, cu.companyId!)
    }

    @Post()
    @Permission('maintenance-group:create')
    create(@Body() dto: CreateMaintenanceGroupDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.maintenanceGroupsService.create(dto, cu.companyId!)
    }

    @Patch(':id')
    @Permission('maintenance-group:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMaintenanceGroupDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceGroupsService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-group:delete')
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.maintenanceGroupsService.remove(id, cu.companyId!)
    }

    @Post(':id/technicians')
    @Permission('maintenance-group:update')
    assignTechnician(
        @Param('id', ParseUUIDPipe) groupId: string,
        @Body() dto: AssignTechnicianToGroupDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceGroupsService.assignTechnician(groupId, dto, cu.companyId!)
    }

    @Delete(':id/technicians/:technicianId')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-group:update')
    removeTechnician(
        @Param('id', ParseUUIDPipe) groupId: string,
        @Param('technicianId', ParseUUIDPipe) technicianId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceGroupsService.removeTechnician(groupId, technicianId, cu.companyId!)
    }

    @Get('technician/:technicianId')
    @Permission('maintenance-group:list')
    findTechnicianGroups(
        @Param('technicianId', ParseUUIDPipe) technicianId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceGroupsService.findTechnicianGroups(technicianId, cu.companyId!)
    }
}
