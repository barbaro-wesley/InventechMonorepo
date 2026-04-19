import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common'
import { LaudoStatus, ESignReferenceType } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateLaudoDto, InitiateLaudoSignDto, ListLaudosDto, UpdateLaudoDto } from '../dto/laudo.dto'
import { LaudoVariablesService } from './laudo-variables.service'
import { ESignDocumentsService } from '../../e-sign/services/esign-documents.service'

function sanitizeFields(raw: any): any[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((f: any) => f !== null && typeof f === 'object' && !Array.isArray(f) && typeof f.type === 'string')
}

@Injectable()
export class LaudosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly variables: LaudoVariablesService,
    private readonly eSign: ESignDocumentsService,
  ) {}

  async previewFields(
    templateId: string,
    companyId: string,
    context: { clientId?: string; serviceOrderId?: string; maintenanceId?: string; technicianId?: string },
  ) {
    const tpl = await this.prisma.laudoTemplate.findFirst({
      where: { id: templateId, companyId, deletedAt: null },
    })
    if (!tpl) throw new NotFoundException('Template não encontrado')

    let clientId = context.clientId ?? null
    if (context.serviceOrderId && !clientId) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: context.serviceOrderId, companyId },
        select: { clientId: true },
      })
      clientId = so?.clientId ?? null
    }

    const vars = await this.variables.resolve({ companyId, ...context, clientId: clientId ?? undefined })
    const fields = sanitizeFields(tpl.fields)
    const resolved = this.variables.applyVariablesToFields(fields, vars)
    return { fields: resolved }
  }

  async create(dto: CreateLaudoDto, companyId: string, createdById: string) {
    // Derive clientId from serviceOrderId when not explicitly provided
    let resolvedClientId = dto.clientId ?? null

    if (dto.serviceOrderId && !resolvedClientId) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: dto.serviceOrderId, companyId },
        select: { clientId: true },
      })
      resolvedClientId = so?.clientId ?? null
    }

    if (dto.maintenanceId && !resolvedClientId) {
      const maint = await this.prisma.maintenance.findFirst({
        where: { id: dto.maintenanceId, companyId },
        select: { clientId: true },
      })
      resolvedClientId = (maint as any)?.clientId ?? null
    }

    // Validate clientId belongs to this company
    if (resolvedClientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: resolvedClientId, companyId, deletedAt: null },
      })
      if (!client) resolvedClientId = null  // silently drop invalid clientId
    }

    // Load template fields if templateId provided
    let fields = dto.fields
    if (dto.templateId) {
      const tpl = await this.prisma.laudoTemplate.findFirst({
        where: { id: dto.templateId, companyId, deletedAt: null },
      })
      if (!tpl) throw new NotFoundException('Template não encontrado')
      // Merge template fields with any provided overrides
      fields = fields?.length ? fields : (tpl.fields as any[])
    }

    // Resolve variables
    const vars = await this.variables.resolve({
      companyId,
      clientId: resolvedClientId,
      serviceOrderId: dto.serviceOrderId,
      maintenanceId: dto.maintenanceId,
      technicianId: dto.technicianId,
    })

    const resolvedFields = this.variables.applyVariablesToFields(fields, vars)

    // Sequential number per company
    const lastLaudo = await this.prisma.laudo.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const number = (lastLaudo?.number ?? 0) + 1

    return this.prisma.laudo.create({
      data: {
        companyId,
        createdById,
        clientId: resolvedClientId,
        templateId: dto.templateId ?? null,
        serviceOrderId: dto.serviceOrderId ?? null,
        maintenanceId: dto.maintenanceId ?? null,
        technicianId: dto.technicianId ?? null,
        number,
        title: dto.title,
        referenceType: dto.referenceType,
        fields: resolvedFields as any,
        resolvedVariables: vars as any,
        notes: dto.notes ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: LaudoStatus.DRAFT,
      },
      include: this.defaultInclude(),
    })
  }

  async findAll(companyId: string, filters: ListLaudosDto, requestingClientId?: string | null) {
    const { page = 1, limit = 20, clientId, status, referenceType, serviceOrderId, maintenanceId, search } = filters
    const skip = (page - 1) * limit

    // Client users can only see their own client's laudos
    const effectiveClientId = requestingClientId ?? clientId

    const where: any = {
      companyId,
      deletedAt: null,
      ...(effectiveClientId && { clientId: effectiveClientId }),
      ...(status && { status }),
      ...(referenceType && { referenceType }),
      ...(serviceOrderId && { serviceOrderId }),
      ...(maintenanceId && { maintenanceId }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    }

    const [data, total] = await Promise.all([
      this.prisma.laudo.findMany({
        where,
        select: {
          id: true, number: true, title: true, status: true, referenceType: true,
          clientId: true, createdAt: true, approvedAt: true, signedAt: true,
          client: { select: { id: true, name: true } },
          template: { select: { id: true, title: true } },
          createdBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } },
        },
        orderBy: { number: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.laudo.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(id: string, companyId: string, requestingClientId?: string | null) {
    const where: any = { id, companyId, deletedAt: null }
    if (requestingClientId) where.clientId = requestingClientId

    const laudo = await this.prisma.laudo.findFirst({
      where,
      include: this.defaultInclude(),
    })
    if (!laudo) throw new NotFoundException('Laudo não encontrado')
    return { ...laudo, fields: sanitizeFields(laudo.fields) }
  }

  async update(id: string, dto: UpdateLaudoDto, companyId: string) {
    const laudo = await this.findOne(id, companyId)
    if (laudo.status !== LaudoStatus.DRAFT)
      throw new BadRequestException('Apenas laudos em DRAFT podem ser editados')

    // Re-resolve variables if references changed
    let updatedFields = dto.fields ?? (laudo.fields as any[])
    if (dto.fields) {
      const vars = await this.variables.resolve({
        companyId,
        clientId: laudo.clientId,
        serviceOrderId: laudo.serviceOrderId,
        maintenanceId: laudo.maintenanceId,
        technicianId: dto.technicianId ?? laudo.technicianId,
      })
      updatedFields = this.variables.applyVariablesToFields(dto.fields, vars)
    }

    return this.prisma.laudo.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.technicianId !== undefined && { technicianId: dto.technicianId }),
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
        fields: updatedFields as any,
      },
      include: this.defaultInclude(),
    })
  }

  async submitForReview(id: string, companyId: string) {
    const laudo = await this.findOne(id, companyId)
    if (laudo.status !== LaudoStatus.DRAFT)
      throw new BadRequestException('Laudo já foi enviado para revisão')

    return this.prisma.laudo.update({
      where: { id },
      data: { status: LaudoStatus.PENDING_REVIEW },
    })
  }

  async approve(id: string, companyId: string, approvedById: string) {
    const laudo = await this.findOne(id, companyId)
    if (laudo.status !== LaudoStatus.PENDING_REVIEW && laudo.status !== LaudoStatus.SIGNED)
      throw new BadRequestException('Laudo deve estar em PENDING_REVIEW ou SIGNED para ser aprovado')

    return this.prisma.laudo.update({
      where: { id },
      data: {
        status: LaudoStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
      },
    })
  }

  async cancel(id: string, companyId: string) {
    const laudo = await this.findOne(id, companyId)
    if (laudo.status === LaudoStatus.APPROVED)
      throw new ForbiddenException('Laudo aprovado não pode ser cancelado')

    return this.prisma.laudo.update({
      where: { id },
      data: { status: LaudoStatus.CANCELLED },
    })
  }

  async remove(id: string, companyId: string) {
    const laudo = await this.findOne(id, companyId)
    if (laudo.status === LaudoStatus.APPROVED)
      throw new ForbiddenException('Laudo aprovado não pode ser excluído')

    await this.prisma.laudo.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return { deleted: true }
  }

  async initiateSign(id: string, companyId: string, createdById: string, dto: InitiateLaudoSignDto) {
    const laudo = await this.findOne(id, companyId)
    if (laudo.status === LaudoStatus.CANCELLED)
      throw new BadRequestException('Laudo cancelado não pode ser assinado')
    if (laudo.status === LaudoStatus.SIGNED || laudo.status === LaudoStatus.APPROVED)
      throw new BadRequestException('Laudo já foi assinado ou aprovado')

    // Generate PDF if not yet done, then use pdfUrl as the source
    if (!laudo.pdfUrl)
      throw new BadRequestException('Gere o PDF do laudo antes de enviar para assinatura')

    const eSignDoc = await this.eSign.create(
      {
        title: `Laudo Nº ${String(laudo.number).padStart(4, '0')} — ${laudo.title}`,
        referenceType: ESignReferenceType.LAUDO,
        referenceId: id,
        requireSigningOrder: dto.requireSigningOrder ?? false,
        expiresAt: dto.expiresAt,
        settings: { sendCopyTo: [], reminderAfterDays: 2 },
      } as any,
      Buffer.from(''),
      companyId,
      createdById,
      laudo.pdfUrl,
    )

    for (const signer of dto.signers) {
      await this.eSign.addSigner(eSignDoc.id, {
        signerName: signer.signerName,
        signerEmail: signer.signerEmail,
        signerPhone: signer.signerPhone,
        signerCpf: signer.signerCpf,
        signerRole: signer.signerRole,
        signingOrder: signer.signingOrder ?? 0,
        notificationChannels: ['EMAIL'] as any,
        customMessage: dto.customMessage,
      }, companyId)
    }

    await this.eSign.send(eSignDoc.id, companyId, createdById)

    return this.linkESign(id, companyId, eSignDoc.id)
  }

  async linkESign(id: string, companyId: string, eSignDocumentId: string) {
    await this.findOne(id, companyId)
    return this.prisma.laudo.update({
      where: { id },
      data: {
        eSignDocumentId,
        status: LaudoStatus.PENDING_SIGNATURE,
      },
    })
  }

  async markSigned(id: string, companyId: string) {
    await this.findOne(id, companyId)
    return this.prisma.laudo.update({
      where: { id },
      data: {
        status: LaudoStatus.SIGNED,
        signedAt: new Date(),
      },
    })
  }

  async savePdfUrl(id: string, pdfUrl: string) {
    return this.prisma.laudo.update({
      where: { id },
      data: { pdfUrl },
    })
  }

  private defaultInclude() {
    return {
      company: { select: { id: true, name: true, document: true } },
      client: { select: { id: true, name: true } },
      template: { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true } },
      technician: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      serviceOrder: { select: { id: true, number: true, title: true } },
      maintenance: { select: { id: true, title: true, type: true } },
    } as const
  }
}
