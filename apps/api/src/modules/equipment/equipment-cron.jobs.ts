import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EquipmentService } from './equipment.service'

@Injectable()
export class EquipmentCronJobs {
    private readonly logger = new Logger(EquipmentCronJobs.name)

    constructor(private readonly equipmentService: EquipmentService) { }

    // ─────────────────────────────────────────
    // Roda a cada 15 minutos — corrige equipamentos presos em
    // "Em Manutenção" sem nenhuma OS ativa vinculada
    // ─────────────────────────────────────────
    @Cron('*/15 * * * *', { name: 'reconcile-equipment-maintenance-status' })
    async reconcileEquipmentStatus() {
        const { updated, equipmentIds } = await this.equipmentService.reconcileUnderMaintenanceStatus()

        if (updated > 0) {
            this.logger.warn(
                `Corrigidos ${updated} equipamento(s) presos em "Em Manutenção" sem OS ativa: ${equipmentIds.join(', ')}`,
            )
        }
    }
}
