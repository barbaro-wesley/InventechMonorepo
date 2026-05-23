import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateAccessoryTemplateDto, UpdateAccessoryTemplateDto } from './dto/template.dto'

@Injectable()
export class TemplatesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(companyId: string, equipmentTypeId?: string) {
        return this.prisma.equipmentAccessoryTemplate.findMany({
            where: {
                companyId,
                ...(equipmentTypeId && { equipmentTypeId }),
            },
            orderBy: { createdAt: 'asc' },
            include: {
                category: { select: { id: true, name: true, color: true } },
                equipmentType: { select: { id: true, name: true } },
            },
        })
    }

    async findOne(id: string, companyId: string) {
        const template = await this.prisma.equipmentAccessoryTemplate.findFirst({
            where: { id, companyId },
            include: {
                category: { select: { id: true, name: true, color: true } },
                equipmentType: { select: { id: true, name: true } },
            },
        })
        if (!template) throw new NotFoundException('Template não encontrado')
        return template
    }

    async create(dto: CreateAccessoryTemplateDto, companyId: string) {
        // Valida que o tipo de equipamento pertence à empresa
        const equipmentType = await this.prisma.equipmentType.findFirst({
            where: { id: dto.equipmentTypeId, companyId },
            select: { id: true },
        })
        if (!equipmentType) throw new NotFoundException('Tipo de equipamento não encontrado')

        // Valida que a categoria pertence à empresa
        const category = await this.prisma.accessoryCategory.findFirst({
            where: { id: dto.categoryId, companyId },
            select: { id: true },
        })
        if (!category) throw new NotFoundException('Categoria de acessório não encontrada')

        try {
            return await this.prisma.equipmentAccessoryTemplate.create({
                data: { ...dto, companyId },
                include: {
                    category: { select: { id: true, name: true, color: true } },
                    equipmentType: { select: { id: true, name: true } },
                },
            })
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException('Já existe um template para esta combinação de tipo de equipamento e categoria')
            }
            throw err
        }
    }

    async update(id: string, dto: UpdateAccessoryTemplateDto, companyId: string) {
        await this.findOne(id, companyId)
        return this.prisma.equipmentAccessoryTemplate.update({
            where: { id },
            data: dto,
            include: {
                category: { select: { id: true, name: true, color: true } },
                equipmentType: { select: { id: true, name: true } },
            },
        })
    }

    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId)
        await this.prisma.equipmentAccessoryTemplate.delete({ where: { id } })
        return { message: 'Template removido com sucesso' }
    }
}
