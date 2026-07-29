import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SlaService } from '../sla.service'

@Injectable()
export class SlaBreachJob {
  private readonly logger = new Logger(SlaBreachJob.name)

  constructor(private readonly slaService: SlaService) {}

  // Roda a cada 30 minutos — reclassifica o status de SLA das OS em aberto
  // (ON_TIME → NEAR_BREACH → BREACHED) conforme os prazos de TPA e conclusão.
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'refresh-sla-statuses' })
  async refreshSlaStatuses() {
    this.logger.log('Cron: reclassificando status de SLA das OS em aberto...')
    try {
      const updated = await this.slaService.refreshSlaStatuses()
      this.logger.log(`Cron SLA concluído — ${updated} OS reclassificada(s).`)
    } catch (err) {
      this.logger.error('Falha ao reclassificar status de SLA', err instanceof Error ? err.stack : String(err))
    }
  }
}
