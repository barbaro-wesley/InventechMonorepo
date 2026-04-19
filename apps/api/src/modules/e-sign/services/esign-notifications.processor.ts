import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { ESignNotificationsService } from './esign-notifications.service'
import { PrismaService } from '../../../prisma/prisma.service'

interface SendInvitationJobData {
  documentId: string
  requestId: string
}

interface SendCompletionJobData {
  documentId: string
}

@Processor('esign-notifications')
export class ESignNotificationsProcessor {
  private readonly logger = new Logger(ESignNotificationsProcessor.name)

  constructor(
    private readonly notifications: ESignNotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send-invitation')
  async handleSendInvitation(job: Job<SendInvitationJobData>) {
    const { documentId, requestId } = job.data

    const request = await this.prisma.eSignRequest.findFirst({
      where: { id: requestId, documentId },
      include: { document: true },
    })

    if (!request) {
      this.logger.warn(`Request ${requestId} not found — skipping invitation`)
      return
    }

    if (request.status === 'SIGNED' || request.status === 'DECLINED') {
      this.logger.log(`Skipping invitation for ${requestId} — already ${request.status}`)
      return
    }

    await this.notifications.sendInvitation(request.document as any, request)
    this.logger.log(`Invitation sent to ${request.signerEmail} for document ${documentId}`)
  }

  @Process('send-completion')
  async handleSendCompletion(job: Job<SendCompletionJobData>) {
    const { documentId } = job.data

    const doc = await this.prisma.eSignDocument.findUnique({
      where: { id: documentId },
      include: { requests: true },
    })

    if (!doc) {
      this.logger.warn(`Document ${documentId} not found — skipping completion emails`)
      return
    }

    await this.notifications.sendCompletionEmails(doc as any)
    this.logger.log(`Completion emails sent for document ${documentId}`)
  }
}
