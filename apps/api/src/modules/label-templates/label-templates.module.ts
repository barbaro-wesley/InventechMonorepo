import { Module } from '@nestjs/common'
import { CompaniesModule } from '../companies/companies.module'
import { LabelTemplatesController } from './label-templates.controller'
import { LabelTemplatesService } from './services/label-templates.service'
import { LabelVariablesService } from './services/label-variables.service'
import { LabelPdfService } from './services/label-pdf.service'

@Module({
  imports: [CompaniesModule],
  controllers: [LabelTemplatesController],
  providers: [LabelTemplatesService, LabelVariablesService, LabelPdfService],
  exports: [LabelTemplatesService, LabelPdfService],
})
export class LabelTemplatesModule {}
