import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma/prisma.service'
import { ESignDocumentStatus, ESignRequestStatus, ESignEventType } from '@prisma/client'
import { ESignAuditService } from './esign-audit.service'
import { ESignNotificationsService } from './esign-notifications.service'

@Injectable()
export class ESignExpirationScheduler {
  private readonly logger = new Logger(ESignExpirationScheduler.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ESignAuditService,
    private readonly notifications: ESignNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleDocumentExpiration() {
    const now = new Date()

    const expiredDocs = await this.prisma.eSignDocument.findMany({
      where: {
        status: { in: [ESignDocumentStatus.PENDING, ESignDocumentStatus.PARTIALLY_SIGNED] },
        expiresAt: { lt: now },
      },
    })

    if (expiredDocs.length === 0) return

    this.logger.log(`Processing ${expiredDocs.length} expired documents`)

    for (const doc of expiredDocs) {
      await this.prisma.eSignDocument.update({
        where: { id: doc.id },
        data: { status: ESignDocumentStatus.EXPIRED },
      })

      await this.audit.log({
        documentId: doc.id,
        eventType: ESignEventType.DOCUMENT_EXPIRED,
        metadata: { expiresAt: doc.expiresAt },
      })

      this.logger.log(`Document ${doc.id} marked as EXPIRED`)
    }

    const pendingRequests = await this.prisma.eSignRequest.findMany({
      where: {
        status: { in: [ESignRequestStatus.PENDING, ESignRequestStatus.VIEWED] },
        tokenExpiresAt: { lt: now },
      },
    })

    for (const req of pendingRequests) {
      await this.prisma.eSignRequest.update({
        where: { id: req.id },
        data: { status: ESignRequestStatus.EXPIRED },
      })

      this.logger.log(`Request ${req.id} marked as EXPIRED`)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handlePendingReminder() {
    const reminderDays = 2
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - reminderDays)

    const pendingRequests = await this.prisma.eSignRequest.findMany({
      where: {
        status: { in: [ESignRequestStatus.PENDING, ESignRequestStatus.VIEWED] },
        document: {
          status: { in: [ESignDocumentStatus.PENDING, ESignDocumentStatus.PARTIALLY_SIGNED] },
        },
        createdAt: { lt: cutoff },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lt: cutoff } },
        ],
      },
      include: { document: true },
      take: 100,
    })

    if (pendingRequests.length === 0) return

    this.logger.log(`Sending reminders to ${pendingRequests.length} pending signers`)

    for (const request of pendingRequests) {
      if (request.reminderCount >= 3) continue

      await this.notifications.sendReminderEmail(request.document, request)
      await this.prisma.eSignRequest.update({
        where: { id: request.id },
        data: {
          reminderCount: { increment: 1 },
          lastReminderAt: new Date(),
        },
      })

      await this.audit.log({
        documentId: request.documentId,
        requestId: request.id,
        eventType: ESignEventType.REMINDER_SENT,
        actorEmail: request.signerEmail,
      })

      this.logger.log(`Reminder ${request.reminderCount + 1} sent to ${request.signerEmail}`)
    }
  }
}