import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue, Job } from 'bull'
import { ConfigService } from '@nestjs/config'
import { ESignNotificationsService } from './esign-notifications.service'
import { PrismaService } from '../../../prisma/prisma.service'

interface ReminderJobData {
  documentId: string
  requestId: string
  signerEmail: string
}

@Injectable()
export class ESignReminderService {
  private readonly logger = new Logger(ESignReminderService.name)

  constructor(
    @InjectQueue('esign-reminders') private readonly reminderQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly notifications: ESignNotificationsService,
    private readonly config: ConfigService,
  ) {}

  async scheduleReminder(
    documentId: string,
    requestId: string,
    signerEmail: string,
    daysFromNow: number = 2,
  ) {
    const delayMs = daysFromNow * 24 * 60 * 60 * 1000

    const job = await this.reminderQueue.add(
      'send-reminder',
      { documentId, requestId, signerEmail },
      { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 60000 } },
    )

    this.logger.log(`Scheduled reminder for request ${requestId} in ${daysFromNow} days (job ${job.id})`)
    return job
  }

  async cancelReminder(requestId: string) {
    const jobs = await this.reminderQueue.getJobs(['waiting', 'delayed'])
    for (const job of jobs) {
      if (job.data.requestId === requestId) {
        await job.remove()
        this.logger.log(`Cancelled reminder for request ${requestId}`)
      }
    }
  }

  async cancelAllReminders(documentId: string) {
    const jobs = await this.reminderQueue.getJobs(['waiting', 'delayed'])
    let cancelled = 0
    for (const job of jobs) {
      if (job.data.documentId === documentId) {
        await job.remove()
        cancelled++
      }
    }
    this.logger.log(`Cancelled ${cancelled} reminders for document ${documentId}`)
    return cancelled
  }

  async sendManualReminder(documentId: string, requestId: string, companyId: string) {
    const request = await this.prisma.eSignRequest.findFirst({
      where: { id: requestId, documentId, document: { companyId } },
      include: { document: true },
    })

    if (!request) {
      throw new Error('Request not found')
    }

    await this.notifications.sendReminderEmail(request.document, request)
    await this.prisma.eSignRequest.update({
      where: { id: requestId },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    })

    this.logger.log(`Manual reminder sent to ${request.signerEmail} for document ${documentId}`)
    return { sent: true }
  }
}