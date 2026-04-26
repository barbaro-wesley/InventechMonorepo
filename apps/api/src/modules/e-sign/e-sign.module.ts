import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { ESignDocumentsController } from './esign-documents.controller'
import { ESignSigningController } from './esign-signing.controller'
import { ESignVerificationController } from './esign-verification.controller'
import { ESignDocumentsService } from './services/esign-documents.service'
import { ESignSigningService } from './services/esign-signing.service'
import { ESignCertificateService } from './services/esign-certificate.service'
import { ESignAuditService } from './services/esign-audit.service'
import { ESignNotificationsService } from './services/esign-notifications.service'
import { ESignPdfService } from './services/esign-pdf.service'
import { ESignReminderService } from './services/esign-reminder.service'
import { ESignReminderProcessor } from './services/esign-reminder.processor'
import { ESignNotificationsProcessor } from './services/esign-notifications.processor'
import { ESignExpirationScheduler } from './services/esign-expiration.scheduler'

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'esign-reminders',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: 'esign-notifications',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [
    ESignDocumentsController,
    ESignSigningController,
    ESignVerificationController,
  ],
  providers: [
    ESignDocumentsService,
    ESignSigningService,
    ESignCertificateService,
    ESignAuditService,
    ESignNotificationsService,
    ESignPdfService,
    ESignReminderService,
    ESignReminderProcessor,
    ESignNotificationsProcessor,
    ESignExpirationScheduler,
  ],
  exports: [ESignDocumentsService, ESignCertificateService, ESignPdfService, ESignReminderService],
})
export class ESignModule {}
