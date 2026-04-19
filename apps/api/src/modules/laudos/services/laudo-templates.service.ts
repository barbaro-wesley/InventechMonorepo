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

  async create(dto: CreateLaudoTemplateDto, companyId: string, createdById: string) {
    return this.prisma.laudoTemplate.create({
      data: {
        companyId,
        createdById,
        title: dto.title,
        description: dto.description,
        referenceType: dto.referenceType,
        fields: dto.fields as any,
        isActive: true,
      },
    })
  }

  async findAll(companyId: string, filters: ListLaudoTemplatesDto) {
    const { page = 1, limit = 50, referenceType, isActive } = filters
    const skip = (page - 1) * limit

    const where = {
      companyId,
      deletedAt: null,
      ...(referenceType && { referenceType }),
      ...(isActive !== undefined && { isActive }),
    }

    const [data, total] = await Promise.all([
      this.prisma.laudoTemplate.findMany({
        where,
        select: {
          id: true, title: true, description: true, referenceType: true,
          isActive: true, createdAt: true,
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

  async findOne(id: string, companyId: string) {
    const template = await this.prisma.laudoTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    if (!template) throw new NotFoundException('Template não encontrado')
    return { ...template, fields: sanitizeFields(template.fields) }
  }

  async update(id: string, dto: UpdateLaudoTemplateDto, companyId: string) {
    await this.findOne(id, companyId)
    return this.prisma.laudoTemplate.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.referenceType && { referenceType: dto.referenceType }),
        ...(dto.fields && { fields: dto.fields as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }

  async clone(id: string, companyId: string, createdById: string) {
    const source = await this.findOne(id, companyId)
    return this.prisma.laudoTemplate.create({
      data: {
        companyId,
        createdById,
        title: `${source.title} (cópia)`,
        description: source.description,
        referenceType: source.referenceType,
        fields: source.fields as any,
        isActive: false,
      },
    })
  }

  async remove(id: string, companyId: string) {
    const template = await this.findOne(id, companyId)
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
