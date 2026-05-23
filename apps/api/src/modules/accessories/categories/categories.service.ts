import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateAccessoryCategoryDto, UpdateAccessoryCategoryDto } from './dto/category.dto'

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(companyId: string, onlyActive = false) {
        return this.prisma.accessoryCategory.findMany({
            where: {
                companyId,
                ...(onlyActive && { isActive: true }),
            },
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { accessories: true } },
            },
        })
    }

    async findOne(id: string, companyId: string) {
        const category = await this.prisma.accessoryCategory.findFirst({
            where: { id, companyId },
            include: { _count: { select: { accessories: true } } },
        })
        if (!category) throw new NotFoundException('Categoria não encontrada')
        return category
    }

    async create(dto: CreateAccessoryCategoryDto, companyId: string) {
        try {
            return await this.prisma.accessoryCategory.create({
                data: { ...dto, companyId },
            })
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException(`Categoria '${dto.name}' já existe nesta empresa`)
            }
            throw err
        }
    }

    async update(id: string, dto: UpdateAccessoryCategoryDto, companyId: string) {
        await this.findOne(id, companyId)
        try {
            return await this.prisma.accessoryCategory.update({
                where: { id },
                data: dto,
            })
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException(`Categoria '${dto.name}' já existe nesta empresa`)
            }
            throw err
        }
    }

    async remove(id: string, companyId: string) {
        const category = await this.findOne(id, companyId)
        if (category._count.accessories > 0) {
            throw new ConflictException('Categoria possui acessórios vinculados e não pode ser removida')
        }
        await this.prisma.accessoryCategory.delete({ where: { id } })
        return { message: 'Categoria removida com sucesso' }
    }
}
