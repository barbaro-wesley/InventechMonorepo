import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GhospController } from './ghosp.controller'
import { GhospService } from './ghosp.service'
import ghospConfig from '../../config/ghosp.config'

@Module({
  imports: [ConfigModule.forFeature(ghospConfig)],
  controllers: [GhospController],
  providers: [GhospService],
})
export class GhospModule {}
