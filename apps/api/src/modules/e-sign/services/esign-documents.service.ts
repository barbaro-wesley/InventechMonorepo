import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { createHash } from 'crypto'
import { ESignDocumentStatus, ESignEventType } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { AddESignRequestDto, CreateESignDocumentDto, ListESignDocumentsDto } from '../dto/esign.dto'
import { ESignAuditService } from './esign-audit.service'
import { ESignCertificateService } from './esign-certificate.service'
import { ESignNotificationsService } from './esign-notifications.service'
import { ESignReminderService } from './esign-reminder.service'

@Injectable()
export class ESignDocumentsService {
  private readonly logger = new Logger(ESignDocumentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ESignAuditService,
    private readonly certificate: ESignCertificateService,
    private readonly notifications: ESignNotificationsService,
    private readonly reminderService: ESignReminderService,
    @InjectQueue('esign-notifications') private readonly notificationsQueue: Queue,
  ) {}

  async create(
    dto: CreateESignDocumentDto,
    fileBuffer: Buffer,
    companyId: string,
    createdById: string,
    fileUrl: string,
  ) {
    const originalHash = createHash('sha256').update(fileBuffer).digest('hex')

    const document = await this.prisma.eSignDocument.create({
      data: {
        companyId,
        createdById,
        title: dto.title,
        description: dto.description,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        requireSigningOrder: dto.requireSigningOrder ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        settings: dto.settings ?? {},
        originalFileUrl: fileUrl,
        originalHash,
        status: ESignDocumentStatus.DRAFT,
      },
    })

    await this.audit.log({
      documentId: document.id,
      eventType: ESignEventType.DOCUMENT_CREATED,
      actorUserId: createdById,
    })

    return document
  }

  async findAll(companyId: string, filters: ListESignDocumentsDto) {
    const { page = 1, limit = 20, referenceType, referenceId, status } = filters
    const skip = (page - 1) * limit

    const where = {
      companyId,
      ...(referenceType && { referenceType }),
      ...(referenceId && { referenceId }),
      ...(status && { status: status as ESignDocumentStatus }),
    }

    const [data, total] = await Promise.all([
      this.prisma.eSignDocument.findMany({
        where,
        include: {
          requests: { select: { id: true, signerName: true, signerEmail: true, signerRole: true, status: true, signedAt: true } },
          certificate: { select: { id: true, certificateHash: true, issuedAt: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.eSignDocument.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(id: string, companyId: string) {
    const doc = await this.prisma.eSignDocument.findFirst({
      where: { id, companyId },
      include: {
        requests: {
          orderBy: { signingOrder: 'asc' },
        },
        events: { orderBy: { occurredAt: 'asc' } },
        certificate: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!doc) throw new NotFoundException('Documento não encontrado')
    return doc
  }

  async addSigner(documentId: string, dto: AddESignRequestDto, companyId: string) {
    const doc = await this.prisma.eSignDocument.findFirst({ where: { id: documentId, companyId } })
    if (!doc) throw new NotFoundException('Documento não encontrado')
    if (doc.status !== ESignDocumentStatus.DRAFT)
      throw new BadRequestException('Não é possível adicionar signatários após envio')

    const expiresAt = doc.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    return this.prisma.eSignRequest.create({
      data: {
        documentId,
        signerName: dto.signerName,
        signerEmail: dto.signerEmail,
        signerPhone: dto.signerPhone,
        signerCpf: dto.signerCpf,
        signerRole: dto.signerRole,
        signerUserId: dto.signerUserId,
        signingOrder: dto.signingOrder ?? 0,
        notificationChannels: dto.notificationChannels,
        customMessage: dto.customMessage,
        tokenExpiresAt: expiresAt,
      },
    })
  }

  async send(documentId: string, companyId: string, actorId: string) {
    const doc = await this.prisma.eSignDocument.findFirst({
      where: { id: documentId, companyId },
      include: { requests: true },
    })

    if (!doc) throw new NotFoundException('Documento não encontrado')
    if (doc.status !== ESignDocumentStatus.DRAFT)
      throw new BadRequestException('Documento já foi enviado')
    if (doc.requests.length === 0)
      throw new BadRequestException('Adicione ao menos um signatário antes de enviar')

    await this.prisma.eSignDocument.update({
      where: { id: documentId },
      data: { status: ESignDocumentStatus.PENDING },
    })

    await this.audit.log({
      documentId,
      eventType: ESignEventType.INVITATION_SENT,
      actorUserId: actorId,
      metadata: { signerCount: doc.requests.length },
    })

    const firstBatch = doc.requireSigningOrder
      ? doc.requests.filter((r) => r.signingOrder === Math.min(...doc.requests.map((x) => x.signingOrder)))
      : doc.requests

    await Promise.all(
      firstBatch.map((req) =>
        this.notificationsQueue.add(
          'send-invitation',
          { documentId, requestId: req.id },
          { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: true },
        ),
      ),
    )

    const settings = (doc.settings as any) ?? {}
    const reminderAfterDays = settings.reminderAfterDays ?? 2

    for (const req of doc.requests) {
      await this.reminderService.scheduleReminder(
        documentId,
        req.id,
        req.signerEmail,
        reminderAfterDays,
      )
    }

    return { sent: true, notified: firstBatch.length }
  }

  async cancel(documentId: string, companyId: string, actorId: string) {
    const doc = await this.prisma.eSignDocument.findFirst({ where: { id: documentId, companyId } })
    if (!doc) throw new NotFoundException('Documento não encontrado')
    if (doc.status === ESignDocumentStatus.COMPLETED)
      throw new ForbiddenException('Documento já concluído não pode ser cancelado')

    await this.prisma.eSignDocument.update({
      where: { id: documentId },
      data: { status: ESignDocumentStatus.CANCELLED },
    })

    await this.audit.log({ documentId, eventType: ESignEventType.DOCUMENT_CANCELLED, actorUserId: actorId })

    await this.reminderService.cancelAllReminders(documentId)
  }

  async checkAndComplete(documentId: string, appBaseUrl: string) {
    const doc = await this.prisma.eSignDocument.findUnique({
      where: { id: documentId },
      include: { requests: true },
    })
    if (!doc) return

    const pending = doc.requests.filter((r) => r.status !== 'SIGNED' && r.status !== 'DECLINED')
    const allSigned = pending.length === 0 && doc.requests.some((r) => r.status === 'SIGNED')

    if (!allSigned) return

    await this.prisma.eSignDocument.update({
      where: { id: documentId },
      data: { status: ESignDocumentStatus.COMPLETED, completedAt: new Date() },
    })

    await this.audit.log({ documentId, eventType: ESignEventType.DOCUMENT_COMPLETED })
    await this.certificate.issue(documentId, appBaseUrl)
    await this.audit.log({ documentId, eventType: ESignEventType.CERTIFICATE_ISSUED })
    await this.notificationsQueue.add(
      'send-completion',
      { documentId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: true },
    )

    // Notify referencing entity (e.g. Laudo) that signing is complete
    if (doc.referenceType === 'LAUDO' && doc.referenceId) {
      try {
        await this.prisma.laudo.update({
          where: { id: doc.referenceId },
          data: { status: 'SIGNED', signedAt: new Date() },
        })
      } catch (err) {
        this.logger.warn(`Could not update laudo ${doc.referenceId} to SIGNED: ${err}`)
      }
    }
  }
}
