import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateChecklistTemplateDto,
  ListChecklistTemplatesDto,
  UpdateChecklistTemplateDto,
} from './dto/checklist-template.dto'
import { FieldDefinition } from '../../common/types/field-definition.types'

@Injectable()
export class ChecklistTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateChecklistTemplateDto,
    companyId: string,
    createdById: string,
    requestingClientId?: string | null,
  ) {
    const effectiveClientId = requestingClientId ?? dto.clientId ?? null
    return this.prisma.checklistTemplate.create({
      data: {
        companyId,
        clientId: effectiveClientId,
        createdById,
        title: dto.title,
        description: dto.description,
        fields: dto.fields as object[],
        isSharedWithClients: dto.isSharedWithClients ?? false,
      },
      select: this.summarySelect(),
    })
  }

  async findAll(
    companyId: string,
    filters: ListChecklistTemplatesDto,
    requestingClientId?: string | null,
  ) {
    const { search, clientId, isActive, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where = this.buildWhereClause(companyId, requestingClientId, { search, clientId, isActive })

    const [data, total] = await this.prisma.$transaction([
      this.prisma.checklistTemplate.findMany({
        where,
        select: this.summarySelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.checklistTemplate.count({ where }),
    ])

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async findOne(
    id: string,
    companyId: string,
    requestingClientId?: string | null,
  ) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
        ...this.clientFilter(requestingClientId),
      },
      select: this.detailSelect(),
    })

    if (!template) throw new NotFoundException('Template de checklist não encontrado')
    return template
  }

  async update(
    id: string,
    dto: UpdateChecklistTemplateDto,
    companyId: string,
    requestingClientId?: string | null,
  ) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { clientId: true },
    })

    if (!template) throw new NotFoundException('Template de checklist não encontrado')

    // Usuário de cliente só pode editar templates do seu próprio cliente
    // Templates compartilhados (clientId: null) são apenas editáveis por usuários da empresa
    if (requestingClientId && template.clientId !== requestingClientId)
      throw new ForbiddenException('Sem permissão para editar este template')

    return this.prisma.checklistTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.fields !== undefined && { fields: dto.fields as object[] }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isSharedWithClients !== undefined && { isSharedWithClients: dto.isSharedWithClients }),
      },
      select: this.detailSelect(),
    })
  }

  async remove(
    id: string,
    companyId: string,
    requestingClientId?: string | null,
  ) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { clientId: true },
    })

    if (!template) throw new NotFoundException('Template de checklist não encontrado')

    if (requestingClientId && template.clientId !== requestingClientId)
      throw new ForbiddenException('Sem permissão para excluir este template')

    // Usuário de cliente não pode excluir templates da empresa
    if (requestingClientId && template.clientId === null)
      throw new ForbiddenException('Templates compartilhados só podem ser excluídos por administradores da empresa')

    const linkedSchedules = await this.prisma.maintenanceSchedule.count({
      where: { checklistTemplateId: id, isActive: true },
    })

    if (linkedSchedules > 0)
      throw new ForbiddenException(
        'Template vinculado a agendamentos ativos — desative-o em vez de excluir',
      )

    return this.prisma.checklistTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    })
  }

  async clone(
    id: string,
    companyId: string,
    clonedById: string,
  ) {
    const source = await this.prisma.checklistTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { title: true, description: true, fields: true, clientId: true, isSharedWithClients: true },
    })

    if (!source) throw new NotFoundException('Template de checklist não encontrado')

    return this.prisma.checklistTemplate.create({
      data: {
        companyId,
        clientId: source.clientId,
        createdById: clonedById,
        title: `${source.title} (cópia)`,
        description: source.description,
        fields: source.fields as object[],
        isActive: false,
        isSharedWithClients: source.isSharedWithClients,
      },
      select: this.summarySelect(),
    })
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  getFieldsForNewChecklist(template: { fields: unknown }): FieldDefinition[] {
    const fields = template.fields as FieldDefinition[]
    return fields.map(f => ({ ...f, value: undefined }))
  }

  private buildWhereClause(
    companyId: string,
    requestingClientId?: string | null,
    filters?: { search?: string; clientId?: string; isActive?: boolean },
  ) {
    const { search, clientId, isActive } = filters ?? {}
    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    if (requestingClientId) {
      return {
        companyId,
        deletedAt: null,
        OR: [
          { clientId: requestingClientId },
          { clientId: null, isSharedWithClients: true },
        ],
        ...(isActive !== undefined && { isActive }),
        ...searchFilter,
      }
    }

    return {
      companyId,
      deletedAt: null,
      ...(clientId !== undefined && {
        clientId: clientId === 'null' ? null : clientId,
      }),
      ...(isActive !== undefined && { isActive }),
      ...searchFilter,
    }
  }

  private clientFilter(requestingClientId?: string | null) {
    if (!requestingClientId) return {}
    return {
      OR: [
        { clientId: requestingClientId },
        { clientId: null, isSharedWithClients: true },
      ],
    }
  }

  private summarySelect() {
    return {
      id: true,
      title: true,
      description: true,
      isActive: true,
      isSharedWithClients: true,
      clientId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { schedules: true } },
    }
  }

  private detailSelect() {
    return {
      ...this.summarySelect(),
      fields: true,
    }
  }
}
