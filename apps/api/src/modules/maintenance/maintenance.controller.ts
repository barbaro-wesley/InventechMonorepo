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

// Manutenções: ainda ligadas a um client (prestadora) — rota mantém clientId
@Controller('clients/:clientId/maintenances')
export class MaintenanceController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Get()
    @Permission('maintenance:list')
    findAll(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Query() filters: ListMaintenancesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findAllMaintenances(clientId, cu.companyId!, filters)
    }

    @Get(':id')
    @Permission('maintenance:read')
    findOne(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findOneMaintenance(id, clientId, cu.companyId!)
    }

    @Post()
    @Permission('maintenance:create')
    create(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() dto: CreateMaintenanceDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.createMaintenance(dto, clientId, cu.companyId!, cu)
    }

    @Patch(':id')
    @Permission('maintenance:update')
    update(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMaintenanceDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.updateMaintenance(id, dto, clientId, cu.companyId!)
    }
}

// Agendamentos: agora escopados à empresa (company), sem clientId na rota
@Controller('maintenance-schedules')
export class ScheduleController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Get()
    @Permission('maintenance-schedule:list')
    findAll(
        @Query() filters: ListSchedulesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findAllSchedules(cu.companyId!, filters)
    }

    @Get(':id')
    @Permission('maintenance-schedule:read')
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.findOneSchedule(id, cu.companyId!)
    }

    @Post()
    @Permission('maintenance-schedule:create')
    create(
        @Body() dto: CreateScheduleDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.createSchedule(dto, cu.clientId!, cu.companyId!, cu)
    }

    @Patch(':id')
    @Permission('maintenance-schedule:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateScheduleDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.updateSchedule(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-schedule:delete')
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.removeSchedule(id, cu.companyId!)
    }

    @Post('trigger')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-schedule:trigger')
    triggerGeneration() {
        return this.maintenanceService.triggerGeneration()
    }
}
