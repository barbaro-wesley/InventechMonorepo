import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateStockCategoryDto, ListStockCategoriesDto, UpdateStockCategoryDto } from './dto/category.dto'

const CATEGORY_SELECT = {
    id: true,
    companyId: true,
    name: true,
    description: true,
    color: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { items: true } },
} satisfies Prisma.StockCategorySelect

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) {}

    async findAll(companyId: string, filters: ListStockCategoriesDto) {
        const { search, isActive, page = 1, limit = 100 } = filters

        const where: Prisma.StockCategoryWhereInput = {
            companyId,
            ...(isActive !== undefined && { isActive }),
            ...(search && { name: { contains: search, mode: 'insensitive' } }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.stockCategory.findMany({
                where,
                select: CATEGORY_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.stockCategory.count({ where }),
        ])

        return { data, pagination: { page, limit, total } }
    }

    async findOne(id: string, companyId: string) {
        const cat = await this.prisma.stockCategory.findFirst({
            where: { id, companyId },
            select: CATEGORY_SELECT,
        })
        if (!cat) throw new NotFoundException('Categoria não encontrada')
        return cat
    }

    async create(dto: CreateStockCategoryDto, companyId: string) {
        const existing = await this.prisma.stockCategory.findFirst({
            where: { companyId, name: dto.name },
            select: { id: true },
        })
        if (existing) throw new ConflictException('Já existe uma categoria com este nome')

        return this.prisma.stockCategory.create({
            data: {
                companyId,
                name: dto.name,
                description: dto.description ?? null,
                color: dto.color ?? null,
            },
            select: CATEGORY_SELECT,
        })
    }

    async update(id: string, dto: UpdateStockCategoryDto, companyId: string) {
        const cat = await this.prisma.stockCategory.findFirst({
            where: { id, companyId },
            select: { id: true, name: true },
        })
        if (!cat) throw new NotFoundException('Categoria não encontrada')

        if (dto.name && dto.name !== cat.name) {
            const existing = await this.prisma.stockCategory.findFirst({
                where: { companyId, name: dto.name, id: { not: id } },
                select: { id: true },
            })
            if (existing) throw new ConflictException('Já existe uma categoria com este nome')
        }

        return this.prisma.stockCategory.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.color !== undefined && { color: dto.color }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: CATEGORY_SELECT,
        })
    }

    async remove(id: string, companyId: string) {
        const cat = await this.prisma.stockCategory.findFirst({
            where: { id, companyId },
            select: { id: true, _count: { select: { items: true } } },
        })
        if (!cat) throw new NotFoundException('Categoria não encontrada')

        if (cat._count.items > 0) {
            throw new BadRequestException('Não é possível remover uma categoria com itens vinculados')
        }

        await this.prisma.stockCategory.delete({ where: { id } })
        return { message: 'Categoria removida com sucesso' }
    }
}
