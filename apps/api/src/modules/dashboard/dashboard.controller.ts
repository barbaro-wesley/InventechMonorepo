import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { DashboardService } from './dashboard.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    // GET /dashboard
    // Visão geral da empresa — métricas consolidadas de todos os clientes
    @Get()
    @ApiOperation({
        summary: 'Dashboard da empresa',
        description:
            'Retorna métricas consolidadas: contadores de OS por status, ' +
            'timeline dos últimos 30 dias, top técnicos, disponibilidade ' +
            'de equipamentos, OS por grupo e alertas ativos.',
    })
    @Permission('dashboard:company')
    getCompanyDashboard(@CurrentUser() cu: AuthenticatedUser) {
        return this.dashboardService.getCompanyDashboard(cu.tenantId!)
    }

    // GET /dashboard/platform
    // Visão consolidada de toda a plataforma — apenas SUPER_ADMIN
    @Get('platform')
    @ApiOperation({
        summary: 'Dashboard da plataforma',
        description:
            'Retorna métricas globais: totais de empresas, usuários, clientes, ' +
            'equipamentos, OS ativas, licenças próximas do vencimento e ' +
            'empresas cadastradas recentemente.',
    })
    @Permission('dashboard:platform')
    getPlatformDashboard() {
        return this.dashboardService.getSuperAdminDashboard()
    }

    // GET /dashboard/client/:organizationId
    // Visão restrita de um cliente específico
    @Get('client/:organizationId')
    @ApiOperation({
        summary: 'Dashboard do cliente',
        description:
            'Retorna métricas de um cliente específico: ' +
            'contadores de OS, disponibilidade de equipamentos e OS recentes.',
    })
    @Permission('dashboard:client')
    getClientDashboard(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.dashboardService.getClientDashboard(cu.tenantId!, organizationId)
    }
}