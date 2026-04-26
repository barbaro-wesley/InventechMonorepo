import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { ESignNotificationsService } from './esign-notifications.service'
import { ESignDocumentsService } from './esign-documents.service'
import { PrismaService } from '../../../prisma/prisma.service'

interface ReminderJobData {
  documentId: string
  requestId: string
  signerEmail: string
}

@Processor('esign-reminders')
export class ESignReminderProcessor {
  private readonly logger = new Logger(ESignReminderProcessor.name)

  constructor(
    private readonly notifications: ESignNotificationsService,
    private readonly documents: ESignDocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send-reminder')
  async handleReminder(job: Job<ReminderJobData>) {
    const { documentId, requestId, signerEmail } = job.data

    const request = await this.prisma.eSignRequest.findFirst({
      where: { id: requestId, documentId },
      include: { document: true },
    })

    if (!request || request.status === 'SIGNED' || request.status === 'DECLINED') {
      this.logger.log(`Skipping reminder for ${requestId} - already signed/declined`)
      return
    }

    if (request.reminderCount >= 3) {
      this.logger.warn(`Max reminders reached for ${requestId}`)
      return
    }

    await this.notifications.sendReminderEmail(request.document, request)
    await this.prisma.eSignRequest.update({
      where: { id: requestId },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    })

    this.logger.log(`Reminder sent to ${signerEmail} for document ${documentId}`)
  }
}