import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AnalyticsEquipmentService } from './services/analytics-equipment.service'
import { AnalyticsOsService } from './services/analytics-os.service'
import { AnalyticsPreventiveService } from './services/analytics-preventive.service'
import { AnalyticsFinancialService } from './services/analytics-financial.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import {
  EquipmentOverviewQueryDto,
  EquipmentRangeQueryDto,
  EquipmentCostsQueryDto,
} from './dto/analytics-equipment-query.dto'
import {
  OsBaseQueryDto,
  OsBacklogQueryDto,
  OsComparisonQueryDto,
  OsTimelineQueryDto,
  TechnicianRankingQueryDto,
  OsCostsQueryDto,
} from './dto/analytics-os-query.dto'
import {
  PreventiveAdherenceQueryDto,
  PreventiveBaseQueryDto,
  PreventiveUpcomingQueryDto,
} from './dto/analytics-preventive-query.dto'
import {
  FinancialQueryDto,
  FinancialTrendQueryDto,
  FinancialTcoQueryDto,
} from './dto/analytics-financial-query.dto'

@ApiTags('Analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly equipmentSvc: AnalyticsEquipmentService,
    private readonly osSvc: AnalyticsOsService,
    private readonly preventiveSvc: AnalyticsPreventiveService,
    private readonly financialSvc: AnalyticsFinancialService,
  ) {}

  // ── Equipamentos ─────────────────────────────────────────────────────────

  @Get('equipment/overview')
  @Permission('analytics:equipment')
  @ApiOperation({
    summary: 'Visão geral do parque de equipamentos',
    description:
      'Totais por status e criticidade, taxa de disponibilidade, ' +
      'valor patrimonial, depreciação acumulada, situação de garantias ' +
      'e quantidade de equipamentos sem agenda preventiva ativa.',
  })
  getEquipmentOverview(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: EquipmentOverviewQueryDto,
  ) {
    return this.equipmentSvc.getOverview(cu.companyId!, query)
  }

  @Get('equipment/top-failures')
  @Permission('analytics:equipment')
  @ApiOperation({
    summary: 'Top equipamentos com mais falhas',
    description:
      'Ranking dos equipamentos com maior número de OS no período, ' +
      'com MTTR individual, MTTR global e custo total de manutenção.',
  })
  getEquipmentTopFailures(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: EquipmentRangeQueryDto,
  ) {
    return this.equipmentSvc.getTopFailures(cu.companyId!, query)
  }

  @Get('equipment/costs')
  @Permission('analytics:equipment')
  @ApiOperation({
    summary: 'Custo de manutenção por equipamento',
    description:
      'Custo total no período por tipo de item ' +
      '(mão de obra, material, serviço externo, deslocamento) ' +
      'agrupado por equipamento, tipo, localização ou centro de custo.',
  })
  getEquipmentCosts(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: EquipmentCostsQueryDto,
  ) {
    return this.equipmentSvc.getCosts(cu.companyId!, query)
  }

  @Get('equipment/without-preventive')
  @Permission('analytics:equipment')
  @ApiOperation({
    summary: 'Equipamentos sem manutenção preventiva ativa',
    description:
      'Lista equipamentos ativos/em manutenção que não possuem ' +
      'agenda preventiva ativa, ordenados por criticidade.',
  })
  getEquipmentWithoutPreventive(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: EquipmentOverviewQueryDto,
  ) {
    return this.equipmentSvc.getWithoutPreventive(cu.companyId!, query)
  }

  @Get('equipment/os-timeline')
  @Permission('analytics:equipment')
  @ApiOperation({
    summary: 'Série temporal de OS por equipamento',
    description:
      'Evolução mensal das OS abertas para equipamentos, ' +
      'separando corretivas e preventivas com taxa de conclusão.',
  })
  getEquipmentOsTimeline(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: EquipmentRangeQueryDto,
  ) {
    return this.equipmentSvc.getOsTimeline(cu.companyId!, query)
  }

  // ── Ordens de Serviço ────────────────────────────────────────────────────

  @Get('service-orders/overview')
  @Permission('analytics:service-orders')
  @ApiOperation({
    summary: 'KPIs consolidados de Ordens de Serviço',
    description:
      'Totais por status, prioridade e tipo de manutenção, ' +
      'métricas de SLA (tempo de resposta e resolução), ' +
      'taxa de aprovação/rejeição, custo total e taxa de OS filhas.',
  })
  getOsOverview(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: OsBaseQueryDto,
  ) {
    return this.osSvc.getOverview(cu.companyId!, query)
  }

  @Get('service-orders/timeline')
  @Permission('analytics:service-orders')
  @ApiOperation({
    summary: 'Série temporal de OS',
    description:
      'Evolução de OS criadas no período agrupadas por dia, semana ou mês, ' +
      'com totais de concluídas, canceladas, corretivas e preventivas.',
  })
  getOsTimeline(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: OsTimelineQueryDto,
  ) {
    return this.osSvc.getTimeline(cu.companyId!, query)
  }

  @Get('service-orders/costs')
  @Permission('analytics:service-orders')
  @ApiOperation({
    summary: 'Custo de OS por dimensão',
    description:
      'Custo total por tipo de item (mão de obra, material, externo, deslocamento) ' +
      'e agrupado por tipo de manutenção, cliente, grupo ou técnico.',
  })
  getOsCosts(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: OsCostsQueryDto,
  ) {
    return this.osSvc.getCosts(cu.companyId!, query)
  }

  // ── Técnicos ─────────────────────────────────────────────────────────────

  @Get('technicians/ranking')
  @Permission('analytics:technicians')
  @ApiOperation({
    summary: 'Ranking de técnicos',
    description:
      'Performance individual por técnico: total de OS, OS concluídas, ' +
      'taxa de conclusão, tempo médio de resposta e resolução, e custo de mão de obra.',
  })
  getTechnicianRanking(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: TechnicianRankingQueryDto,
  ) {
    return this.osSvc.getTechnicianRanking(cu.companyId!, query)
  }

  @Get('service-orders/backlog')
  @Permission('analytics:service-orders')
  @ApiOperation({
    summary: 'Aging do backlog de OS',
    description:
      'OS abertas (excluindo aprovadas e canceladas) agrupadas por faixa de idade: ' +
      '<7 dias, 7–30 dias, 30–90 dias e >90 dias. ' +
      'Inclui contagem de urgentes por faixa e lista das 15 OS mais antigas.',
  })
  getOsBacklog(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: OsBacklogQueryDto,
  ) {
    return this.osSvc.getBacklogAging(cu.companyId!, query)
  }

  @Get('service-orders/comparison')
  @Permission('analytics:service-orders')
  @ApiOperation({
    summary: 'Comparativo de período e First-Time Fix Rate',
    description:
      'Compara o período informado com o período anterior de mesma duração. ' +
      'Retorna deltas absolutos e percentuais para total, concluídas, custo, ' +
      'tempo médio de resposta/resolução e First-Time Fix Rate ' +
      '(% de OS concluídas sem gerar OS filha).',
  })
  getOsComparison(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: OsComparisonQueryDto,
  ) {
    return this.osSvc.getComparison(cu.companyId!, query)
  }

  // ── Preventivas ──────────────────────────────────────────────────────────

  @Get('preventive/adherence')
  @Permission('analytics:preventive')
  @ApiOperation({
    summary: 'Taxa de aderência às manutenções preventivas',
    description:
      'Total de manutenções programadas vs executadas no prazo, com atraso ' +
      'ou não executadas. Taxa de aderência e execução por tipo de recorrência.',
  })
  getPreventiveAdherence(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: PreventiveAdherenceQueryDto,
  ) {
    return this.preventiveSvc.getAdherence(cu.companyId!, query)
  }

  @Get('preventive/upcoming')
  @Permission('analytics:preventive')
  @ApiOperation({
    summary: 'Próximas manutenções preventivas',
    description:
      'Lista das preventivas agendadas para os próximos N dias ' +
      '(padrão 30), com equipamento, técnico responsável e localização.',
  })
  getPreventiveUpcoming(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: PreventiveUpcomingQueryDto,
  ) {
    return this.preventiveSvc.getUpcoming(cu.companyId!, query)
  }

  @Get('preventive/overdue')
  @Permission('analytics:preventive')
  @ApiOperation({
    summary: 'Preventivas atrasadas',
    description:
      'Agendas preventivas ativas com nextRunAt anterior à data atual, ' +
      'ordenadas por atraso mais antigo, com contagem por criticidade do equipamento.',
  })
  getPreventiveOverdue(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: PreventiveBaseQueryDto,
  ) {
    return this.preventiveSvc.getOverdue(cu.companyId!, query)
  }

  @Get('preventive/by-recurrence')
  @Permission('analytics:preventive')
  @ApiOperation({
    summary: 'Resumo de agendas por tipo de recorrência',
    description:
      'Total de agendas ativas agrupadas por tipo de recorrência ' +
      '(diária, semanal, mensal etc.) com atrasadas e previstas para os próximos 7/30 dias.',
  })
  getPreventiveByRecurrence(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: PreventiveBaseQueryDto,
  ) {
    return this.preventiveSvc.getByRecurrence(cu.companyId!, query)
  }

  // ── Financeiro ───────────────────────────────────────────────────────────

  @Get('financial/overview')
  @Permission('analytics:financial')
  @ApiOperation({
    summary: 'Resumo financeiro de manutenção',
    description:
      'Custo total do período por tipo de item (mão de obra, material, externo, deslocamento), ' +
      'comparação automática com o período anterior de mesma duração e custo médio por OS.',
  })
  getFinancialOverview(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: FinancialQueryDto,
  ) {
    return this.financialSvc.getOverview(cu.companyId!, query)
  }

  @Get('financial/trend')
  @Permission('analytics:financial')
  @ApiOperation({
    summary: 'Evolução do custo de manutenção',
    description:
      'Série mensal ou trimestral do custo total, detalhada por tipo de item, ' +
      'útil para identificar tendências e sazonalidade nos gastos de manutenção.',
  })
  getFinancialTrend(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: FinancialTrendQueryDto,
  ) {
    return this.financialSvc.getTrend(cu.companyId!, query)
  }

  @Get('financial/tco')
  @Permission('analytics:financial')
  @ApiOperation({
    summary: 'Custo Total de Propriedade (TCO) por equipamento',
    description:
      'Ranking dos equipamentos com maior custo acumulado de manutenção. ' +
      'Para cada equipamento: valor de compra, custo de manutenção histórico, ' +
      'TCO total e índice de custo (custo manutenção / valor compra %).',
  })
  getFinancialTco(
    @CurrentUser() cu: AuthenticatedUser,
    @Query() query: FinancialTcoQueryDto,
  ) {
    return this.financialSvc.getTco(cu.companyId!, query)
  }
}
