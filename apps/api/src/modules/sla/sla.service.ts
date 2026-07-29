import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ServiceOrderPriority, SlaStatus } from '@prisma/client'
import { BatchUpdateSlaConfigDto } from './dto/update-sla-config.dto'

export const DEFAULT_SLA_HOURS: Record<ServiceOrderPriority, { responseHours: number; resolutionHours: number }> = {
  URGENT: { responseHours: 1, resolutionHours: 4 },
  HIGH:   { responseHours: 2, resolutionHours: 12 },
  MEDIUM: { responseHours: 4, resolutionHours: 24 },
  LOW:    { responseHours: 8, resolutionHours: 72 },
}

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name)

  constructor(private readonly prisma: PrismaService) {}

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

    const slaResponseDueDate = new Date(createdAt.getTime() + responseHours * 3600000)
    const slaResolutionDueDate = new Date(createdAt.getTime() + resolutionHours * 3600000)

    return {
      slaResponseDueDate,
      slaResolutionDueDate,
      slaStatus: SlaStatus.ON_TIME,
    }
  }
}
