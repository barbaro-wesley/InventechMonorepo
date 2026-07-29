import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MaintenanceType, ServiceOrderPriority, SlaStatus } from '@prisma/client'
import { BatchUpdateSlaConfigDto } from './dto/update-sla-config.dto'

export const DEFAULT_SLA_HOURS: Record<ServiceOrderPriority, { responseHours: number; resolutionHours: number }> = {
  URGENT: { responseHours: 1, resolutionHours: 4 },
  HIGH:   { responseHours: 2, resolutionHours: 12 },
  MEDIUM: { responseHours: 4, resolutionHours: 24 },
  LOW:    { responseHours: 8, resolutionHours: 72 },
}

// SLA de execução padrão das preventivas: 30 dias após a abertura automática.
export const DEFAULT_PREVENTIVE_SLA_DAYS = 30

// Tipos de manutenção cujo SLA de conclusão segue a regra de execução das
// preventivas (prazo em dias) e não os prazos por prioridade das corretivas.
const PREVENTIVE_LIKE_TYPES: MaintenanceType[] = [
  MaintenanceType.PREVENTIVE,
  MaintenanceType.INITIAL_ACCEPTANCE,
]

const HOUR_MS = 3600000
const DAY_MS = 24 * HOUR_MS

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────
  // Configurações de SLA de corretivas por prioridade
  // ─────────────────────────────────────────
  async getCompanySlaConfigs(companyId: string) {
    const configs = await this.prisma.companySlaConfig.findMany({
      where: { companyId },
    })

    const configMap = new Map(configs.map((c) => [c.priority, c]))

    const allPriorities: ServiceOrderPriority[] = [
      ServiceOrderPriority.URGENT,
      ServiceOrderPriority.HIGH,
      ServiceOrderPriority.MEDIUM,
      ServiceOrderPriority.LOW,
    ]

    return allPriorities.map((priority) => {
      const existing = configMap.get(priority)
      const fallback = DEFAULT_SLA_HOURS[priority]

      return {
        priority,
        maxResponseHours: existing ? Number(existing.maxResponseHours) : fallback.responseHours,
        maxResolutionHours: existing ? Number(existing.maxResolutionHours) : fallback.resolutionHours,
        isCustomized: !!existing,
      }
    })
  }

  async updateCompanySlaConfigs(companyId: string, dto: BatchUpdateSlaConfigDto) {
    for (const config of dto.configs) {
      await this.prisma.companySlaConfig.upsert({
        where: {
          companyId_priority: {
            companyId,
            priority: config.priority,
          },
        },
        create: {
          companyId,
          priority: config.priority,
          maxResponseHours: config.maxResponseHours,
          maxResolutionHours: config.maxResolutionHours,
        },
        update: {
          maxResponseHours: config.maxResponseHours,
          maxResolutionHours: config.maxResolutionHours,
        },
      })
    }

    return this.getCompanySlaConfigs(companyId)
  }

  // ─────────────────────────────────────────
  // Parâmetro de SLA de execução das preventivas (em dias)
  // ─────────────────────────────────────────
  async getPreventiveSlaDays(companyId: string): Promise<number> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { preventiveSlaDays: true },
    })
    return company?.preventiveSlaDays ?? DEFAULT_PREVENTIVE_SLA_DAYS
  }

  async updatePreventiveSlaDays(companyId: string, executionDays: number): Promise<{ executionDays: number }> {
    const days = Math.max(1, Math.round(executionDays))
    await this.prisma.company.update({
      where: { id: companyId },
      data: { preventiveSlaDays: days },
    })
    return { executionDays: days }
  }

  // ─────────────────────────────────────────
  // Cálculo das datas de SLA na abertura da OS
  // ─────────────────────────────────────────

  /**
   * Datas de SLA para corretivas (e demais tipos que seguem prazo por
   * prioridade). Resposta = TPA (primeiro atendimento), Resolução = conclusão.
   */
  async calculateSlaDates(
    companyId: string,
    priority: ServiceOrderPriority,
    createdAt: Date = new Date(),
  ): Promise<{
    slaResponseDueDate: Date
    slaResolutionDueDate: Date
    slaStatus: SlaStatus
  }> {
    const config = await this.prisma.companySlaConfig.findUnique({
      where: {
        companyId_priority: {
          companyId,
          priority,
        },
      },
    })

    const fallback = DEFAULT_SLA_HOURS[priority] || DEFAULT_SLA_HOURS.MEDIUM
    const responseHours = config ? Number(config.maxResponseHours) : fallback.responseHours
    const resolutionHours = config ? Number(config.maxResolutionHours) : fallback.resolutionHours

    const slaResponseDueDate = new Date(createdAt.getTime() + responseHours * HOUR_MS)
    const slaResolutionDueDate = new Date(createdAt.getTime() + resolutionHours * HOUR_MS)

    return {
      slaResponseDueDate,
      slaResolutionDueDate,
      slaStatus: SlaStatus.ON_TIME,
    }
  }

  /**
   * Datas de SLA para preventivas: prazo de execução em dias após a abertura
   * automática (padrão 30 dias). Não há prazo de primeiro atendimento (TPA).
   */
  async calculatePreventiveSlaDates(
    companyId: string,
    createdAt: Date = new Date(),
  ): Promise<{
    slaResponseDueDate: null
    slaResolutionDueDate: Date
    slaStatus: SlaStatus
  }> {
    const days = await this.getPreventiveSlaDays(companyId)
    return {
      slaResponseDueDate: null,
      slaResolutionDueDate: new Date(createdAt.getTime() + days * DAY_MS),
      slaStatus: SlaStatus.ON_TIME,
    }
  }

  /**
   * Resolve as datas de SLA de acordo com o tipo de manutenção da OS:
   * preventivas/aceitação inicial usam o prazo de execução em dias;
   * corretivas e demais tipos usam os prazos por prioridade.
   */
  async resolveSlaDates(
    companyId: string,
    maintenanceType: MaintenanceType,
    priority: ServiceOrderPriority,
    createdAt: Date = new Date(),
  ): Promise<{
    slaResponseDueDate: Date | null
    slaResolutionDueDate: Date
    slaStatus: SlaStatus
  }> {
    if (PREVENTIVE_LIKE_TYPES.includes(maintenanceType)) {
      return this.calculatePreventiveSlaDates(companyId, createdAt)
    }
    return this.calculateSlaDates(companyId, priority, createdAt)
  }

  // ─────────────────────────────────────────
  // Reclassificação periódica do status de SLA das OS em aberto
  // ON_TIME → NEAR_BREACH → BREACHED ("atrasada")
  // ─────────────────────────────────────────

  /**
   * Recalcula o slaStatus das OS não-terminais com base nas datas de SLA:
   *  - BREACHED ("atrasada"): passou do prazo de conclusão, ou passou do prazo
   *    de primeiro atendimento sem que a OS tenha iniciado.
   *  - NEAR_BREACH: dentro dos últimos 20% da janela até o prazo de conclusão.
   *  - ON_TIME: dentro do prazo.
   * OS já concluídas (COMPLETED_ON_TIME / COMPLETED_LATE) não são alteradas.
   * Retorna a quantidade de OS reclassificadas.
   */
  async refreshSlaStatuses(): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE "service_orders" so
      SET "sla_status" = CASE
        WHEN (so."started_at" IS NULL
              AND so."sla_response_due_date" IS NOT NULL
              AND NOW() > so."sla_response_due_date")
          OR (so."sla_resolution_due_date" IS NOT NULL
              AND NOW() > so."sla_resolution_due_date")
          THEN 'BREACHED'::"SlaStatus"
        WHEN so."sla_resolution_due_date" IS NOT NULL
             AND NOW() >= so."sla_resolution_due_date"
                          - (so."sla_resolution_due_date" - so."created_at") * 0.2
          THEN 'NEAR_BREACH'::"SlaStatus"
        ELSE 'ON_TIME'::"SlaStatus"
      END
      WHERE so."deleted_at" IS NULL
        AND so."status" IN ('OPEN', 'AWAITING_PICKUP', 'IN_PROGRESS')
        AND so."sla_status" IN ('ON_TIME', 'NEAR_BREACH', 'BREACHED')
        AND so."sla_status" IS DISTINCT FROM (CASE
          WHEN (so."started_at" IS NULL
                AND so."sla_response_due_date" IS NOT NULL
                AND NOW() > so."sla_response_due_date")
            OR (so."sla_resolution_due_date" IS NOT NULL
                AND NOW() > so."sla_resolution_due_date")
            THEN 'BREACHED'::"SlaStatus"
          WHEN so."sla_resolution_due_date" IS NOT NULL
               AND NOW() >= so."sla_resolution_due_date"
                            - (so."sla_resolution_due_date" - so."created_at") * 0.2
            THEN 'NEAR_BREACH'::"SlaStatus"
          ELSE 'ON_TIME'::"SlaStatus"
        END)
    `

    if (result > 0) {
      this.logger.log(`SLA: ${result} OS reclassificada(s) por vencimento de prazo.`)
    }
    return result
  }
}
