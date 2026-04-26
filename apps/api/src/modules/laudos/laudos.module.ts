import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CompaniesModule } from '../companies/companies.module'
import { ESignModule } from '../e-sign/e-sign.module'
import { LaudoTemplatesController } from './laudo-templates.controller'
import { LaudosController } from './laudos.controller'
import { LaudoTemplatesService } from './services/laudo-templates.service'
import { LaudosService } from './services/laudos.service'
import { LaudoVariablesService } from './services/laudo-variables.service'
import { LaudoPdfService } from './services/laudo-pdf.service'

@Module({
  imports: [ConfigModule, ESignModule, CompaniesModule],
  controllers: [LaudoTemplatesController, LaudosController],
  providers: [
    LaudoTemplatesService,
    LaudosService,
    LaudoVariablesService,
    LaudoPdfService,
  ],
  exports: [LaudosService, LaudoPdfService],
})
export class LaudosModule {}
