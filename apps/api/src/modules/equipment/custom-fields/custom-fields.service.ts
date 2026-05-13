import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import {
    CreateCustomFieldDefinitionDto,
    UpdateCustomFieldDefinitionDto,
    ReorderCustomFieldsDto,
    UpsertCustomFieldValuesDto,
} from './dto/custom-field.dto'

@Injectable()
export class CustomFieldsService {
    constructor(private prisma: PrismaService) { }

    async listDefinitions(companyId: string) {
        return this.prisma.equipmentCustomFieldDefinition.findMany({
            where: { companyId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        })
    }

    async createDefinition(companyId: string, dto: CreateCustomFieldDefinitionDto) {
        if (dto.fieldType === 'SELECT') {
            if (!dto.options || dto.options.length === 0) {
                throw new BadRequestException('Campos do tipo SELECT precisam ter pelo menos uma opção')
            }
        }

        const maxOrder = await this.prisma.equipmentCustomFieldDefinition.aggregate({
            where: { companyId },
            _max: { order: true },
        })
        const nextOrder = dto.order ?? ((maxOrder._max.order ?? -1) + 1)

        return this.prisma.equipmentCustomFieldDefinition.create({
            data: {
                companyId,
                name: dto.name,
                fieldType: dto.fieldType,
                required: dto.required ?? false,
                order: nextOrder,
                options: dto.options ?? undefined,
            },
        })
    }

    async updateDefinition(companyId: string, id: string, dto: UpdateCustomFieldDefinitionDto) {
        const existing = await this.prisma.equipmentCustomFieldDefinition.findFirst({
            where: { id, companyId },
        })
        if (!existing) throw new NotFoundException('Campo personalizado não encontrado')

        const newType = dto.fieldType ?? existing.fieldType
        if (newType === 'SELECT') {
            const opts = dto.options ?? (existing.options as string[] | null)
            if (!opts || opts.length === 0) {
                throw new BadRequestException('Campos do tipo SELECT precisam ter pelo menos uma opção')
            }
        }

        return this.prisma.equipmentCustomFieldDefinition.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.fieldType !== undefined && { fieldType: dto.fieldType }),
                ...(dto.required !== undefined && { required: dto.required }),
                ...(dto.order !== undefined && { order: dto.order }),
                ...(dto.options !== undefined && { options: dto.options }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        })
    }

    async deleteDefinition(companyId: string, id: string) {
        const existing = await this.prisma.equipmentCustomFieldDefinition.findFirst({
            where: { id, companyId },
        })
        if (!existing) throw new NotFoundException('Campo personalizado não encontrado')

        await this.prisma.equipmentCustomFieldDefinition.delete({ where: { id } })
        return { success: true }
    }

    async reorder(companyId: string, dto: ReorderCustomFieldsDto) {
        await this.prisma.$transaction(
            dto.ids.map((id, index) =>
                this.prisma.equipmentCustomFieldDefinition.updateMany({
                    where: { id, companyId },
                    data: { order: index },
                }),
            ),
        )
        return this.listDefinitions(companyId)
    }

    async upsertValues(companyId: string, equipmentId: string, dto: UpsertCustomFieldValuesDto) {
        // Verify equipment belongs to company
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: equipmentId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        // Verify all definitions belong to company
        const definitionIds = dto.values.map((v) => v.definitionId)
        if (definitionIds.length > 0) {
            const defs = await this.prisma.equipmentCustomFieldDefinition.findMany({
                where: { id: { in: definitionIds }, companyId },
                select: { id: true, required: true, name: true },
            })
            if (defs.length !== definitionIds.length) {
                throw new BadRequestException('Um ou mais campos personalizados são inválidos')
            }
            for (const def of defs) {
                const val = dto.values.find((v) => v.definitionId === def.id)
                if (def.required && (!val?.value || val.value.trim() === '')) {
                    throw new BadRequestException(`O campo "${def.name}" é obrigatório`)
                }
            }
        }

        await this.prisma.$transaction(
            dto.values.map((v) =>
                this.prisma.equipmentCustomFieldValue.upsert({
                    where: { equipmentId_definitionId: { equipmentId, definitionId: v.definitionId } },
                    create: { equipmentId, definitionId: v.definitionId, value: v.value ?? null },
                    update: { value: v.value ?? null },
                }),
            ),
        )

        return this.getValues(equipmentId)
    }

    async getValues(equipmentId: string) {
        return this.prisma.equipmentCustomFieldValue.findMany({
            where: { equipmentId },
            include: { definition: true },
            orderBy: { definition: { order: 'asc' } },
        })
    }
}
