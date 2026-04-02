import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query, ParseUUIDPipe,
    HttpCode, HttpStatus,
} from '@nestjs/common'
import { MaintenanceService } from './maintenance.service'
import {
    CreateMaintenanceDto,
    UpdateMaintenanceDto,
    ListMaintenancesDto,
    CreateScheduleDto,
    UpdateScheduleDto,
    ListSchedulesDto,
} from './dto/maintenance.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('clients/:organizationId/maintenances')
export class MaintenanceController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Get()
    @Permission('maintenance:list')
    findAll(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Query() filters: ListMaintenancesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findAllMaintenances(organizationId, cu.tenantId!, filters)
    }

    @Get(':id')
    @Permission('maintenance:read')
    findOne(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findOneMaintenance(id, organizationId, cu.tenantId!)
    }

    @Post()
    @Permission('maintenance:create')
    create(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Body() dto: CreateMaintenanceDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.createMaintenance(dto, organizationId, cu.tenantId!, cu)
    }

    @Patch(':id')
    @Permission('maintenance:update')
    update(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMaintenanceDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.updateMaintenance(id, dto, organizationId, cu.tenantId!)
    }
}

@Controller('clients/:organizationId/maintenance-schedules')
export class ScheduleController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Get()
    @Permission('maintenance-schedule:list')
    findAll(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Query() filters: ListSchedulesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findAllSchedules(organizationId, cu.tenantId!, filters)
    }

    @Get(':id')
    @Permission('maintenance-schedule:read')
    findOne(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findOneSchedule(id, organizationId, cu.tenantId!)
    }

    @Post()
    @Permission('maintenance-schedule:create')
    create(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Body() dto: CreateScheduleDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.createSchedule(dto, organizationId, cu.tenantId!, cu)
    }

    @Patch(':id')
    @Permission('maintenance-schedule:update')
    update(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateScheduleDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.updateSchedule(id, dto, organizationId, cu.tenantId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-schedule:delete')
    remove(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.removeSchedule(id, organizationId, cu.tenantId!)
    }

    @Post('trigger')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-schedule:trigger')
    triggerGeneration() {
        return this.maintenanceService.triggerGeneration()
    }
}
