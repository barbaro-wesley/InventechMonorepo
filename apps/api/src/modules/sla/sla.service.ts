import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MaintenanceType, ServiceOrderPriority, SlaStatus } from '@prisma/client'
import { BatchUpdateSlaConfigDto } from './dto/update-sla-config.dto'
import { BatchUpdateMaintenanceTypeSlaDto } from './dto/update-maintenance-type-sla.dto'

export const DEFAULT_SLA_HOURS: Record<ServiceOrderPriority, { responseHours: number; resolutionHours: number }> = {
  URGENT: { responseHours: 1, resolutionHours: 4 },
  HIGH:   { responseHours: 2, resolutionHours: 12 },
  MEDIUM: { responseHours: 4, resolutionHours: 24 },
  LOW:    { responseHours: 8, resolutionHours: 72 },
}

// SLA de execução padrão das preventivas: 30 dias após a abertura automática.
export const DEFAULT_PREVENTIVE_SLA_DAYS = 30

/**
 * Prazos de conclusão padrão (em HORAS) por tipo de manutenção, usados quando a
 * empresa ainda não personalizou o par (tipo, prioridade).
 *
 * CORRECTIVE não aparece aqui de propósito: seu SLA sai de CompanySlaConfig.
 */
export const DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS: Record<
  Exclude<MaintenanceType, 'CORRECTIVE'>,
  number
> = {
  PREVENTIVE:         DEFAULT_PREVENTIVE_SLA_DAYS * 24,
  INITIAL_ACCEPTANCE: 72,
  EXTERNAL_SERVICE:   168,
  TECHNOVIGILANCE:    72,
  TRAINING:           720,
  IMPROPER_USE:       72,
  DEACTIVATION:       168,
}

/** Tipos configuráveis por tipo de manutenção (todos menos corretiva). */
export const MAINTENANCE_TYPE_SLA_TYPES = Object.keys(
  DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS,
) as Exclude<MaintenanceType, 'CORRECTIVE'>[]

export const SLA_PRIORITIES: ServiceOrderPriority[] = [
  ServiceOrderPriority.URGENT,
  ServiceOrderPriority.HIGH,
  ServiceOrderPriority.MEDIUM,
  ServiceOrderPriority.LOW,
]

/**
 * Prazos padrão de um par (tipo, prioridade).
 *
 * O prazo de conclusão padrão não varia por prioridade: o mesmo valor do tipo
 * vale para as quatro, para que ligar a dimensão de prioridade não altere
 * nenhum prazo vigente. O TPA nasce nulo — ver nota abaixo.
 *
 * TPA padrão nulo é deliberado: `refreshSlaStatuses` marca BREACHED quando
 * `startedAt` é nulo e o prazo de TPA venceu. Semear um TPA aqui classificaria
 * de imediato como atrasada toda OS aberta e ainda não iniciada — inclusive as
 * preventivas de 30 dias. O TPA é opt-in por par (tipo, prioridade).
 */
export function defaultMaintenanceTypeSla(
  maintenanceType: Exclude<MaintenanceType, 'CORRECTIVE'>,
): { responseHours: number | null; resolutionHours: number } {
  return {
    responseHours: null,
    resolutionHours: DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS[maintenanceType],
  }
}

/**
 * Indica se o tipo segue o SLA por prioridade da tabela de corretivas em vez do
 * SLA por tipo. A checagem é positiva sobre a tabela de tipos configuráveis:
 * corretiva — e qualquer tipo novo ainda sem prazo próprio — cai em
 * CompanySlaConfig, em vez de herdar silenciosamente o prazo longo das
 * preventivas.
 */
function followsPrioritySla(type: MaintenanceType): boolean {
  return !(type in DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS)
}

const HOUR_MS = 3600000

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
  // Configurações de SLA por tipo de manutenção (em horas)
  // ─────────────────────────────────────────

  /**
   * Retorna a matriz completa (tipo × prioridade), mesclando o que a empresa
   * personalizou com os padrões. Corretiva não entra — usa CompanySlaConfig.
   */
  async getMaintenanceTypeSlaConfigs(companyId: string) {
    const configs = await this.prisma.companyMaintenanceTypeSla.findMany({
      where: { companyId },
    })

    const key = (type: MaintenanceType, priority: ServiceOrderPriority) => `${type}:${priority}`
    const configMap = new Map(configs.map((c) => [key(c.maintenanceType, c.priority), c]))

    return MAINTENANCE_TYPE_SLA_TYPES.flatMap((maintenanceType) =>
      SLA_PRIORITIES.map((priority) => {
        const existing = configMap.get(key(maintenanceType, priority))
        const fallback = defaultMaintenanceTypeSla(maintenanceType)

        return {
          maintenanceType,
          priority,
          maxResponseHours:
            existing?.maxResponseHours != null
              ? Number(existing.maxResponseHours)
              : fallback.responseHours,
          maxResolutionHours: existing
            ? Number(existing.maxResolutionHours)
            : fallback.resolutionHours,
          isCustomized: !!existing,
        }
      }),
    )
  }

  async updateMaintenanceTypeSlaConfigs(companyId: string, dto: BatchUpdateMaintenanceTypeSlaDto) {
    const invalid = dto.configs.find((c) => followsPrioritySla(c.maintenanceType))
    if (invalid) {
      throw new BadRequestException(
        'O SLA de corretivas é definido por prioridade em PUT /sla-configs, não por tipo de manutenção.',
      )
    }

    for (const config of dto.configs) {
      const resolutionHours = Math.max(1, Math.round(config.maxResolutionHours))
      const responseHours =
        config.maxResponseHours == null ? null : Math.max(0, Math.round(config.maxResponseHours))

      await this.prisma.companyMaintenanceTypeSla.upsert({
        where: {
          companyId_maintenanceType_priority: {
            companyId,
            maintenanceType: config.maintenanceType,
            priority: config.priority,
          },
        },
        create: {
          companyId,
          maintenanceType: config.maintenanceType,
          priority: config.priority,
          maxResponseHours: responseHours,
          maxResolutionHours: resolutionHours,
        },
        update: {
          maxResponseHours: responseHours,
          maxResolutionHours: resolutionHours,
        },
      })
    }

    return this.getMaintenanceTypeSlaConfigs(companyId)
  }

  /** Prazos efetivos (em horas) de um par (tipo, prioridade), com fallback. */
  private async getMaintenanceTypeSlaHours(
    companyId: string,
    maintenanceType: MaintenanceType,
    priority: ServiceOrderPriority,
  ): Promise<{ responseHours: number | null; resolutionHours: number }> {
    const configurableType = maintenanceType as Exclude<MaintenanceType, 'CORRECTIVE'>
    const fallback =
      configurableType in DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS
        ? defaultMaintenanceTypeSla(configurableType)
        : defaultMaintenanceTypeSla(MaintenanceType.PREVENTIVE)

    const config = await this.prisma.companyMaintenanceTypeSla.findUnique({
      where: {
        companyId_maintenanceType_priority: { companyId, maintenanceType, priority },
      },
    })
    if (!config) return fallback

    return {
      responseHours:
        config.maxResponseHours != null ? Number(config.maxResponseHours) : fallback.responseHours,
      resolutionHours: Number(config.maxResolutionHours),
    }
  }

  // ─────────────────────────────────────────
  // Compatibilidade: prazo das preventivas em dias
  // Delegam para a linha PREVENTIVE do SLA por tipo (armazenada em horas).
  // ─────────────────────────────────────────
  async getPreventiveSlaDays(companyId: string): Promise<number> {
    // MEDIUM é a prioridade representativa: é com ela que as preventivas são
    // geradas automaticamente.
    const { resolutionHours } = await this.getMaintenanceTypeSlaHours(
      companyId,
      MaintenanceType.PREVENTIVE,
      ServiceOrderPriority.MEDIUM,
    )
    return Math.max(1, Math.round(resolutionHours / 24))
  }

  async updatePreventiveSlaDays(companyId: string, executionDays: number): Promise<{ executionDays: number }> {
    const days = Math.max(1, Math.round(executionDays))
    // A semântica antiga era um prazo único de preventiva, sem prioridade —
    // então grava nas quatro para manter o comportamento do endpoint.
    await this.updateMaintenanceTypeSlaConfigs(companyId, {
      configs: SLA_PRIORITIES.map((priority) => ({
        maintenanceType: MaintenanceType.PREVENTIVE,
        priority,
        maxResponseHours: null,
        maxResolutionHours: days * 24,
      })),
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
   * Datas de SLA dos tipos não-corretivos (preventiva, aceitação inicial, etc.),
   * a partir dos prazos em horas do par (tipo, prioridade).
   * O TPA é opcional: quando não configurado, a OS não tem prazo de primeiro
   * atendimento e só é cobrada pela conclusão.
   */
  async calculateMaintenanceTypeSlaDates(
    companyId: string,
    maintenanceType: MaintenanceType,
    priority: ServiceOrderPriority,
    createdAt: Date = new Date(),
  ): Promise<{
    slaResponseDueDate: Date | null
    slaResolutionDueDate: Date
    slaStatus: SlaStatus
  }> {
    const { responseHours, resolutionHours } = await this.getMaintenanceTypeSlaHours(
      companyId,
      maintenanceType,
      priority,
    )

    return {
      slaResponseDueDate:
        responseHours != null ? new Date(createdAt.getTime() + responseHours * HOUR_MS) : null,
      slaResolutionDueDate: new Date(createdAt.getTime() + resolutionHours * HOUR_MS),
      slaStatus: SlaStatus.ON_TIME,
    }
  }

  /**
   * Resolve as datas de SLA de acordo com o tipo de manutenção da OS.
   * Todos os tipos consideram a prioridade do chamado; a diferença é a origem
   * dos prazos: corretiva sai de CompanySlaConfig, os demais tipos saem da
   * matriz (tipo × prioridade) de CompanyMaintenanceTypeSla.
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
    if (followsPrioritySla(maintenanceType)) {
      return this.calculateSlaDates(companyId, priority, createdAt)
    }
    return this.calculateMaintenanceTypeSlaDates(companyId, maintenanceType, priority, createdAt)
  }

  // ─────────────────────────────────────────
  // Reclassificação periódica do status de SLA das OS em aberto
  // ON_TIME → NEAR_BREACH → BREACHED ("atrasada")
  // ─────────────────────────────────────────

  /**
   * Definição de "primeiro atendimento" (decisão de negócio, 2026-07-29):
   * o TPA fecha quando a OS entra em IN_PROGRESS, ou seja no início efetivo do
   * trabalho (`startedAt`) — não no vínculo nem no aceite do técnico.
   *
   * As alternativas foram avaliadas e descartadas:
   *  - `serviceOrderTechnician.assignedAt`: quem atribui é o gestor, sem ação do
   *    técnico. Mediria a agilidade da atribuição, e bastaria atribuir tudo na
   *    abertura para o indicador ficar sempre perfeito.
   *  - `assumedAt`: só é gravado no fluxo de auto-atribuição (técnico pega do
   *    painel), onde já é simultâneo ao `startedAt`. Na atribuição feita pelo
   *    gestor fica nulo, então hoje não serve como marco de aceite.
   *
   * Consequência aceita: deslocamento e agendamento contam dentro do TPA. Os
   * prazos configurados por tipo/prioridade devem levar isso em conta — não use
   * valores de helpdesk (1–4h) para OS que exigem ir até o equipamento.
   */

  /**
   * Grava o momento do estouro do prazo de primeiro atendimento (TPA) nas OS em
   * aberto que passaram do prazo sem iniciar.
   *
   * Só grava onde ainda está nulo — o campo é a prova durável da violação e
   * nunca é reescrito nem limpo. Sem ele a violação se perderia: `slaStatus` é
   * recalculado a cada rodada e voltaria a ON_TIME assim que a OS iniciasse.
   *
   * Retorna a quantidade de OS marcadas.
   */
  async stampResponseBreaches(): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE "service_orders" so
      SET "sla_response_breached_at" = NOW()
      WHERE so."deleted_at" IS NULL
        AND so."sla_response_breached_at" IS NULL
        AND so."started_at" IS NULL
        AND so."sla_response_due_date" IS NOT NULL
        AND NOW() > so."sla_response_due_date"
        AND so."status" IN ('OPEN', 'AWAITING_PICKUP', 'IN_PROGRESS')
    `

    if (result > 0) {
      this.logger.warn(`SLA: ${result} OS estourou(aram) o prazo de primeiro atendimento (TPA).`)
    }
    return result
  }

  /**
   * Recalcula o slaStatus das OS não-terminais com base nas datas de SLA:
   *  - BREACHED ("atrasada"): passou do prazo de conclusão, ou o TPA já foi
   *    estourado (`sla_response_breached_at` preenchido).
   *  - NEAR_BREACH: dentro dos últimos 20% da janela até o prazo de conclusão.
   *  - ON_TIME: dentro do prazo.
   *
   * A condição de TPA olha o campo persistido, não `started_at IS NULL`: assim
   * uma OS atendida com atraso permanece BREACHED em vez de voltar a ON_TIME.
   * Chame `stampResponseBreaches` antes, para que o campo esteja atualizado.
   *
   * OS já concluídas (COMPLETED_ON_TIME / COMPLETED_LATE) não são alteradas.
   * Retorna a quantidade de OS reclassificadas.
   */
  async refreshSlaStatuses(): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE "service_orders" so
      SET "sla_status" = CASE
        WHEN so."sla_response_breached_at" IS NOT NULL
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
          WHEN so."sla_response_breached_at" IS NOT NULL
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
