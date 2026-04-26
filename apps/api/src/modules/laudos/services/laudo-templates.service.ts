import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateLaudoTemplateDto, ListLaudoTemplatesDto, UpdateLaudoTemplateDto } from '../dto/laudo.dto'

function sanitizeFields(raw: any): any[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((f: any) => f !== null && typeof f === 'object' && !Array.isArray(f) && typeof f.type === 'string')
}

@Injectable()
export class LaudoTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLaudoTemplateDto, companyId: string, createdById: string, requestingClientId?: string | null) {
    // Client users can only create templates for their own clientId
    const effectiveClientId = requestingClientId ?? dto.clientId ?? null

    return this.prisma.laudoTemplate.create({
      data: {
        companyId,
        createdById,
        clientId: effectiveClientId,
        title: dto.title,
        description: dto.description,
        referenceType: dto.referenceType,
        fields: dto.fields as any,
        isActive: true,
        isSharedWithClients: dto.isSharedWithClients ?? false,
        signatureConfig: dto.signatureConfig ? (dto.signatureConfig as any) : null,
      },
    })
  }

  async findAll(companyId: string, filters: ListLaudoTemplatesDto, requestingClientId?: string | null) {
    const { page = 1, limit = 50, referenceType, isActive, clientId } = filters
    const skip = (page - 1) * limit

    let where: any

    if (requestingClientId) {
      // Client users see: their own templates + company templates shared with clients
      where = {
        companyId,
        deletedAt: null,
        OR: [
          { clientId: requestingClientId },
          { clientId: null, isSharedWithClients: true },
        ],
        ...(referenceType && { referenceType }),
        ...(isActive !== undefined && { isActive }),
      }
    } else {
      // Company users: filter by explicit clientId if provided, otherwise all company templates
      const effectiveClientId = clientId ?? undefined
      where = {
        companyId,
        deletedAt: null,
        ...(effectiveClientId !== undefined && { clientId: effectiveClientId === 'null' ? null : effectiveClientId }),
        ...(referenceType && { referenceType }),
        ...(isActive !== undefined && { isActive }),
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.laudoTemplate.findMany({
        where,
        select: {
          id: true, title: true, description: true, referenceType: true,
          isActive: true, isSharedWithClients: true, clientId: true,
          signatureConfig: true, createdAt: true,
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { laudos: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.laudoTemplate.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(id: string, companyId: string, requestingClientId?: string | null) {
    let where: any = { id, companyId, deletedAt: null }

    if (requestingClientId) {
      where = {
        id, companyId, deletedAt: null,
        OR: [
          { clientId: requestingClientId },
          { clientId: null, isSharedWithClients: true },
        ],
      }
    }

    const template = await this.prisma.laudoTemplate.findFirst({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    })
    if (!template) throw new NotFoundException('Template não encontrado')
    return { ...template, fields: sanitizeFields(template.fields) }
  }

  async update(id: string, dto: UpdateLaudoTemplateDto, companyId: string, requestingClientId?: string | null) {
    const template = await this.findOne(id, companyId, requestingClientId)

    // Client users can only edit their own templates
    if (requestingClientId && template.clientId !== requestingClientId)
      throw new ForbiddenException('Sem permissão para editar este template')

    return this.prisma.laudoTemplate.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.referenceType && { referenceType: dto.referenceType }),
        ...(dto.fields && { fields: dto.fields as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isSharedWithClients !== undefined && { isSharedWithClients: dto.isSharedWithClients }),
        ...(dto.signatureConfig !== undefined && { signatureConfig: dto.signatureConfig as any ?? null }),
      },
    })
  }

  async clone(id: string, companyId: string, createdById: string, requestingClientId?: string | null) {
    const source = await this.findOne(id, companyId, requestingClientId)

    // Cloned template inherits the same clientId scope as the source if client is cloning
    const cloneClientId = requestingClientId ?? source.clientId ?? null

    return this.prisma.laudoTemplate.create({
      data: {
        companyId,
        createdById,
        clientId: cloneClientId,
        title: `${source.title} (cópia)`,
        description: source.description,
        referenceType: source.referenceType,
        fields: source.fields as any,
        isActive: false,
        isSharedWithClients: false,
        signatureConfig: (source as any).signatureConfig ?? null,
      },
    })
  }

  async remove(id: string, companyId: string, requestingClientId?: string | null) {
    const template = await this.findOne(id, companyId, requestingClientId)

    if (requestingClientId && template.clientId !== requestingClientId)
      throw new ForbiddenException('Sem permissão para excluir este template')

    const hasLaudos = await this.prisma.laudo.count({
      where: { templateId: id, deletedAt: null },
    })
    if (hasLaudos > 0)
      throw new ForbiddenException('Template possui laudos vinculados — desative em vez de excluir')

    await this.prisma.laudoTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return { deleted: true }
  }
}
