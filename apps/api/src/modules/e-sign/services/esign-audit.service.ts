import { Injectable } from '@nestjs/common'
import { ESignEventType } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'

interface LogEventParams {
  documentId: string
  requestId?: string
  eventType: ESignEventType
  actorUserId?: string
  actorName?: string
  actorEmail?: string
  ipAddress?: string
  userAgent?: string
  geolocation?: Record<string, unknown>
  deviceFingerprint?: string
  metadata?: Record<string, unknown>
}

@Injectable()
export class ESignAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogEventParams) {
    return this.prisma.eSignEvent.create({ data: { ...params } })
  }

  async getDocumentTimeline(documentId: string) {
    return this.prisma.eSignEvent.findMany({
      where: { documentId },
      orderBy: { occurredAt: 'asc' },
    })
  }
}
