import { Injectable, NotFoundException } from '@nestjs/common'
import { LabelReferenceType, Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  CreateLabelTemplateDto,
  ListLabelTemplatesDto,
  UpdateLabelTemplateDto,
  LabelElement,
  LabelLayout,
} from '../dto/label-template.dto'

const ELEMENT_TYPES = ['text', 'qrcode', 'image']

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

/** Garante que o layout guardado tem forma válida (defensivo contra payloads malformados). */
function sanitizeLayout(raw: any): LabelLayout {
  const width = clamp(raw?.width, 5, 500, 50)
  const height = clamp(raw?.height, 5, 500, 30)
  const elementsRaw = Array.isArray(raw?.elements) ? raw.elements : []

  const elements: LabelElement[] = elementsRaw
    .filter((e: any) => e && typeof e === 'object' && ELEMENT_TYPES.includes(e.type))
    .map((e: any, i: number): LabelElement => {
      const base = {
        id: typeof e.id === 'string' && e.id ? e.id : `el_${i}`,
        x: clamp(e.x, 0, width, 0),
        y: clamp(e.y, 0, height, 0),
        width: clamp(e.width, 1, width, 10),
        height: clamp(e.height, 1, height, 10),
        ...(typeof e.rotation === 'number' ? { rotation: e.rotation } : {}),
      }
      if (e.type === 'text') {
        return {
          ...base,
          type: 'text',
          content: String(e.content ?? ''),
          fontSize: clamp(e.fontSize, 3, 72, 7),
          fontWeight: e.fontWeight === 'bold' ? 'bold' : 'normal',
          italic: !!e.italic,
          align: ['left', 'center', 'right'].includes(e.align) ? e.align : 'left',
          color: typeof e.color === 'string' ? e.color : '#000000',
        }
      }
      if (e.type === 'qrcode') {
        return {
          ...base,
          type: 'qrcode',
          value: String(e.value ?? '{qr_url}'),
          errorCorrectionLevel: ['L', 'M', 'Q', 'H'].includes(e.errorCorrectionLevel)
            ? e.errorCorrectionLevel
            : 'M',
        }
      }
      return {
        ...base,
        type: 'image',
        source: 'company_logo',
        fit: e.fit === 'cover' ? 'cover' : 'contain',
      }
    })

  return {
    width,
    height,
    unit: 'mm',
    ...(typeof raw?.background === 'string' ? { background: raw.background } : {}),
    elements,
  }
}

@Injectable()
export class LabelTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Se este template virar default, remove o default dos demais do mesmo tipo. */
  private async unsetOtherDefaults(
    tx: Prisma.TransactionClient,
    companyId: string,
    referenceType: LabelReferenceType,
    exceptId?: string,
  ) {
    await tx.labelTemplate.updateMany({
      where: {
        companyId,
        referenceType,
        isDefault: true,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    })
  }

  async create(dto: CreateLabelTemplateDto, companyId: string, createdById: string) {
    const layout = sanitizeLayout(dto.layout)
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.labelTemplate.create({
        data: {
          companyId,
          createdById,
          name: dto.name,
          description: dto.description,
          referenceType: dto.referenceType,
          layout: layout as unknown as Prisma.InputJsonValue,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
        },
      })
      if (created.isDefault)
        await this.unsetOtherDefaults(tx, companyId, dto.referenceType, created.id)
      return created
    })
  }

  async findAll(companyId: string, filters: ListLabelTemplatesDto) {
    const { page = 1, limit = 50, referenceType, isActive } = filters
    const skip = (page - 1) * limit

    const where: Prisma.LabelTemplateWhereInput = {
      companyId,
      deletedAt: null,
      ...(referenceType && { referenceType }),
      ...(isActive !== undefined && { isActive }),
    }

    const [data, total] = await Promise.all([
      this.prisma.labelTemplate.findMany({
        where,
        select: {
          id: true, name: true, description: true, referenceType: true,
          isDefault: true, isActive: true, layout: true, createdAt: true, updatedAt: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.labelTemplate.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async findOne(id: string, companyId: string) {
    const template = await this.prisma.labelTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    if (!template) throw new NotFoundException('Template de etiqueta não encontrado')
    return template
  }

  /** Template default (ativo) para um tipo de referência, ou null. */
  async findDefaultFor(companyId: string, referenceType: LabelReferenceType) {
    return this.prisma.labelTemplate.findFirst({
      where: { companyId, referenceType, isDefault: true, isActive: true, deletedAt: null },
    })
  }

  async update(id: string, dto: UpdateLabelTemplateDto, companyId: string) {
    const existing = await this.findOne(id, companyId)
    const referenceType = dto.referenceType ?? existing.referenceType

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.labelTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.referenceType && { referenceType: dto.referenceType }),
          ...(dto.layout && { layout: sanitizeLayout(dto.layout) as unknown as Prisma.InputJsonValue }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      })
      if (updated.isDefault)
        await this.unsetOtherDefaults(tx, companyId, referenceType, id)
      return updated
    })
  }

  async clone(id: string, companyId: string, createdById: string) {
    const source = await this.findOne(id, companyId)
    return this.prisma.labelTemplate.create({
      data: {
        companyId,
        createdById,
        name: `${source.name} (cópia)`,
        description: source.description,
        referenceType: source.referenceType,
        layout: source.layout as unknown as Prisma.InputJsonValue,
        isDefault: false,
        isActive: false,
      },
    })
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId)
    await this.prisma.labelTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false },
    })
    return { deleted: true }
  }
}
