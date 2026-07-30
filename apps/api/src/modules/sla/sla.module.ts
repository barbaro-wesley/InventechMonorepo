import { Module } from '@nestjs/common'
import { SlaService } from './sla.service'
import { SlaController } from './sla.controller'
import { SlaBreachJob } from './jobs/sla-breach.job'

@Module({
  controllers: [SlaController],
  providers: [SlaService, SlaBreachJob],
  exports: [SlaService],
})
export class SlaModule {}
