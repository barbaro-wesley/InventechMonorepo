import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ServiceOrderStatus } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

@Injectable()
export class AutoApproveJob {
    private readonly logger = new Logger(AutoApproveJob.name)

    constructor(private readonly prisma: PrismaService) { }

    // Roda todo dia às 03:00 — aprova automaticamente OS concluídas há mais de 3 dias
    @Cron('0 3 * * *')
    async autoApproveStaleCompletedOrders() {
        const cutoff = new Date(Date.now() - THREE_DAYS_MS)

        this.logger.log(`Auto-aprovação: buscando OS concluídas antes de ${cutoff.toISOString()}`)

        const pending = await this.prisma.serviceOrder.findMany({
            where: {
                status: ServiceOrderStatus.COMPLETED,
                completedAt: { lt: cutoff },
            },
            select: { id: true, number: true },
        })

        if (pending.length === 0) {
            this.logger.log('Nenhuma OS pendente de aprovação automática.')
            return
        }

        this.logger.log(`Auto-aprovando ${pending.length} OS(s): ${pending.map((o) => o.number).join(', ')}`)

        const ids = pending.map((o) => o.id)

        await this.prisma.serviceOrder.updateMany({
            where: { id: { in: ids } },
            data: {
                status: ServiceOrderStatus.COMPLETED_APPROVED,
                approvedAt: new Date(),
                // approvedById permanece null — indica aprovação automática
            },
        })

        this.logger.log(`${pending.length} OS(s) aprovadas automaticamente.`)
    }
}
