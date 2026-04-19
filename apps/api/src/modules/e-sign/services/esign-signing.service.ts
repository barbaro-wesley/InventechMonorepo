import { Injectable, NotFoundException, BadRequestException, GoneException } from '@nestjs/common'
import { createHash } from 'crypto'
import { ESignEventType, ESignRequestStatus } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { DeclineSignatureDto, SubmitSignatureDto } from '../dto/esign.dto'
import { ESignAuditService } from './esign-audit.service'
import { ESignDocumentsService } from './esign-documents.service'
import { ESignNotificationsService } from './esign-notifications.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ESignSigningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ESignAuditService,
    private readonly documents: ESignDocumentsService,
    private readonly notifications: ESignNotificationsService,
    private readonly config: ConfigService,
  ) {}

  async getRequestByToken(token: string) {
    const request = await this.prisma.eSignRequest.findUnique({
      where: { token },
      include: {
        document: {
          include: {
            company: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    })

    if (!request) throw new NotFoundException('Link de assinatura inválido')
    if (request.tokenExpiresAt < new Date()) throw new GoneException('Link de assinatura expirado')
    if (request.status === ESignRequestStatus.SIGNED) throw new BadRequestException('Documento já assinado')
    if (request.status === ESignRequestStatus.DECLINED) throw new BadRequestException('Documento recusado')
    if (request.document.status === 'CANCELLED') throw new BadRequestException('Documento cancelado')
    if (request.document.status === 'EXPIRED') throw new BadRequestException('Documento expirado')

    return request
  }

  async markViewed(token: string, ipAddress: string, userAgent: string) {
    const request = await this.prisma.eSignRequest.findUnique({ where: { token } })
    if (!request) throw new NotFoundException('Link inválido')

    if (!request.viewedAt) {
      await this.prisma.eSignRequest.update({
        where: { token },
        data: { viewedAt: new Date(), status: ESignRequestStatus.VIEWED },
      })

      await this.audit.log({
        documentId: request.documentId,
        requestId: request.id,
        eventType: ESignEventType.DOCUMENT_VIEWED,
        actorName: request.signerName,
        actorEmail: request.signerEmail,
        ipAddress,
        userAgent,
      })
    }
  }

  async sign(token: string, dto: SubmitSignatureDto, ipAddress: string, userAgent: string) {
    const request = await this.getRequestByToken(token)

    if (request.document.requireSigningOrder) {
      const allRequests = await this.prisma.eSignRequest.findMany({
        where: { documentId: request.documentId },
        orderBy: { signingOrder: 'asc' },
      })
      const pendingBefore = allRequests.filter(
        (r) => r.signingOrder < request.signingOrder && r.status !== 'SIGNED',
      )
      if (pendingBefore.length > 0)
        throw new BadRequestException('Aguardando assinaturas anteriores na ordem definida')
    }

    const signatureHash = createHash('sha256').update(dto.signatureData).digest('hex')

    await this.prisma.eSignRequest.update({
      where: { token },
      data: {
        status: ESignRequestStatus.SIGNED,
        signatureData: dto.signatureData,
        signatureType: dto.signatureType,
        signedAt: new Date(),
      },
    })

    await this.audit.log({
      documentId: request.documentId,
      requestId: request.id,
      eventType: ESignEventType.DOCUMENT_SIGNED,
      actorName: request.signerName,
      actorEmail: request.signerEmail,
      ipAddress,
      userAgent,
      geolocation: dto.geolocation as Record<string, unknown>,
      deviceFingerprint: dto.deviceFingerprint,
      metadata: { signatureHash, signatureType: dto.signatureType },
    })

    if (request.document.requireSigningOrder) {
      await this.notifyNextSigner(request.documentId, request.signingOrder)
    }

    const appBaseUrl = this.config.get<string>('APP_BASE_URL') ?? 'https://app.inventech.com.br'
    await this.documents.checkAndComplete(request.documentId, appBaseUrl)

    return { signed: true }
  }

  async decline(token: string, dto: DeclineSignatureDto, ipAddress: string, userAgent: string) {
    const request = await this.getRequestByToken(token)

    await this.prisma.eSignRequest.update({
      where: { token },
      data: {
        status: ESignRequestStatus.DECLINED,
        declinedAt: new Date(),
        declineReason: dto.reason,
      },
    })

    await this.audit.log({
      documentId: request.documentId,
      requestId: request.id,
      eventType: ESignEventType.DOCUMENT_DECLINED,
      actorName: request.signerName,
      actorEmail: request.signerEmail,
      ipAddress,
      userAgent,
      metadata: { reason: dto.reason },
    })

    await this.notifications.sendDeclineAlert(request.document, request, dto.reason)
  }

  private async notifyNextSigner(documentId: string, currentOrder: number) {
    const nextRequests = await this.prisma.eSignRequest.findMany({
      where: {
        documentId,
        signingOrder: { gt: currentOrder },
        status: ESignRequestStatus.PENDING,
      },
      orderBy: { signingOrder: 'asc' },
      take: 1,
    })

    if (nextRequests.length > 0) {
      const doc = await this.prisma.eSignDocument.findUnique({ where: { id: documentId } })
      if (doc) {
        await this.notifications.sendInvitation(doc, nextRequests[0])
      }
    }
  }
}
