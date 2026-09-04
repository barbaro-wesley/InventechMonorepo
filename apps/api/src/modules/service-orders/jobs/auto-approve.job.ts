import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EquipmentStatus, MaintenanceType, ServiceOrderStatus } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { maintenanceTypeBlocksEquipment } from '../../../common/enums/maintenance-type.enum'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

// Tipos de manutenção que de fato param o equipamento (mesma regra usada na
// aprovação manual em ServiceOrdersService).
const BLOCKING_MAINTENANCE_TYPES: MaintenanceType[] = (
    Object.values(MaintenanceType) as MaintenanceType[]
).filter((t) => maintenanceTypeBlocksEquipment(t))

// OS que não mantêm mais o equipamento "em manutenção".
const TERMINAL_STATUSES: ServiceOrderStatus[] = [
    ServiceOrderStatus.COMPLETED_APPROVED,
    ServiceOrderStatus.CANCELLED,
]

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
                deletedAt: null,
            },
            select: { id: true, number: true, equipmentId: true, maintenanceType: true },
        })

        if (pending.length === 0) {
            this.logger.log('Nenhuma OS pendente de aprovação automática.')
            return
        }

        this.logger.log(`Auto-aprovando ${pending.length} OS(s): ${pending.map((o) => o.number).join(', ')}`)

        const approvedAt = new Date()

        await this.prisma.$transaction(
            async (tx) => {
                // 1) Aprova todas as OS pendentes de uma vez.
                //    approvedById permanece null — indica aprovação automática.
                await tx.serviceOrder.updateMany({
                    where: { id: { in: pending.map((o) => o.id) } },
                    data: { status: ServiceOrderStatus.COMPLETED_APPROVED, approvedAt },
                })

                // 2) Replica os efeitos colaterais no equipamento que a aprovação
                //    manual (ServiceOrdersService.updateStatus) aplica. Sem isso, uma
                //    OS de desativação auto-aprovada nunca inativava o equipamento e a
                //    reconciliação periódica ainda o revertia para ATIVO.
                for (const os of pending) {
                    if (!os.equipmentId) continue

                    // OS de desativação aprovada → inativa o equipamento diretamente.
                    if (os.maintenanceType === MaintenanceType.DEACTIVATION) {
                        await tx.equipment.updateMany({
                            where: { id: os.equipmentId },
                            data: { status: EquipmentStatus.INACTIVE, lastMaintenanceAt: approvedAt },
                        })
                        continue
                    }

                    // Demais tipos: registra a data da última manutenção...
                    await tx.equipment.updateMany({
                        where: { id: os.equipmentId },
                        data: { lastMaintenanceAt: approvedAt },
                    })

                    // ...e só reverte para ATIVO quando não há mais OS que de fato
                    // param o equipamento (as recém-aprovadas já contam como terminais).
                    const activeOsCount = await tx.serviceOrder.count({
                        where: {
                            equipmentId: os.equipmentId,
                            deletedAt: null,
                            status: { notIn: TERMINAL_STATUSES },
                            maintenanceType: { in: BLOCKING_MAINTENANCE_TYPES },
                        },
                    })
                    if (activeOsCount === 0) {
                        await tx.equipment.updateMany({
                            where: { id: os.equipmentId, status: EquipmentStatus.UNDER_MAINTENANCE },
                            data: { status: EquipmentStatus.ACTIVE },
                        })
                    }
                }
            },
            { timeout: 120_000, maxWait: 10_000 },
        )

        this.logger.log(`${pending.length} OS(s) aprovadas automaticamente.`)
    }
}
