import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query, ParseUUIDPipe,
    HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { MaintenanceService } from './maintenance.service'
import {
    CreateMaintenanceDto,
    UpdateMaintenanceDto,
    ListMaintenancesDto,
    CreateScheduleDto,
    UpdateScheduleDto,
    ListSchedulesDto,
    ToggleScheduleDto,
} from './dto/maintenance.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

const CLIENT_ROLES: UserRole[] = [UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER, UserRole.CLIENT_VIEWER]

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

// Agendamentos — visão geral da empresa (sem filtro de cliente)
@Controller('maintenance-schedules')
export class CompanyScheduleController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Get()
    @Permission('maintenance-schedule:list')
    findAll(
        @Query() filters: ListSchedulesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        // Roles de cliente DEVEM ter clientId — nunca podem ver dados de outros clientes
        const isClientRole = CLIENT_ROLES.includes(cu.role)
        if (isClientRole && !cu.clientId) {
            throw new ForbiddenException('Acesso restrito ao cliente vinculado')
        }
        const clientId = isClientRole ? cu.clientId! : undefined
        return this.maintenanceService.findAllSchedules(cu.companyId!, filters, clientId)
    }

    @Get('upcoming')
    @Permission('maintenance-schedule:list')
    upcoming(
        @Query('daysAhead') daysAhead: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.getUpcomingPreventives(
            daysAhead ? Number(daysAhead) : 30,
        )
    }

    @Patch(':id/toggle')
    @HttpCode(HttpStatus.OK)
    @Permission('maintenance-schedule:update')
    toggle(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ToggleScheduleDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.updateSchedule(id, { isActive: dto.isActive }, cu.companyId!)
    }
}

// Agendamentos escopados por cliente
@Controller('clients/:clientId/maintenance-schedules')
export class ScheduleController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    /** CLIENT_ADMIN/USER só podem acessar o próprio cliente */
    private assertClientAccess(cu: AuthenticatedUser, clientId: string) {
        if (CLIENT_ROLES.includes(cu.role) && cu.clientId !== clientId) {
            throw new ForbiddenException('Acesso restrito ao cliente vinculado')
        }
    }

    @Get()
    @Permission('maintenance-schedule:list')
    findAll(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Query() filters: ListSchedulesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        this.assertClientAccess(cu, clientId)
        return this.maintenanceService.findAllSchedules(cu.companyId!, filters, clientId)
    }

    @Get(':id')
    @Permission('maintenance-schedule:read')
    findOne(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        this.assertClientAccess(cu, clientId)
        return this.maintenanceService.findOneSchedule(id, cu.companyId!, clientId)
    }

    @Post()
    @Permission('maintenance-schedule:create')
    create(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() dto: CreateScheduleDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        this.assertClientAccess(cu, clientId)
        return this.maintenanceService.createSchedule(dto, clientId, cu.companyId!, cu)
    }

    @Patch(':id')
    @Permission('maintenance-schedule:update')
    update(
        @Param('clientId', ParseUUIDPipe) clientId: string,
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
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.maintenanceService.removeSchedule(id, cu.companyId!)
    }

    @Post('trigger')
    @HttpCode(HttpStatus.CREATED)
    @Permission('maintenance-schedule:trigger')
    triggerGeneration() {
        return this.maintenanceService.triggerGeneration()
    }
}
