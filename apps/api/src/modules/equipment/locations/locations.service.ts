import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import {
    CreateLocationDto,
    UpdateLocationDto,
    ListLocationsDto,
} from './dto/location.dto'
import { Prisma } from '@prisma/client'

const LOCATION_SELECT = {
    id: true,
    companyId: true,
    costCenterId: true,
    name: true,
    parentId: true,
    description: true,
    isActive: true,
    createdAt: true,
    costCenter: { select: { id: true, name: true, code: true } },
    parent: { select: { id: true, name: true } },
    children: { select: { id: true, name: true, isActive: true } },
    _count: { select: { equipments: true } },
} satisfies Prisma.LocationSelect

@Injectable()
export class LocationsService {
    constructor(private prisma: PrismaService) { }

    async findAll(
        companyId: string,
        filters: ListLocationsDto,
    ) {
        const { search, parentId, costCenterId, isActive, page = 1, limit = 50 } = filters

        const where: Prisma.LocationWhereInput = {
            companyId,
            ...(isActive !== undefined && { isActive }),
            ...(parentId !== undefined && { parentId }),
            ...(costCenterId !== undefined && { costCenterId }),
            ...(search && {
                name: { contains: search, mode: 'insensitive' },
            }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.location.findMany({
                where,
                select: LOCATION_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.location.count({ where }),
        ])

        return { data, total, page, limit }
    }

    // Retorna árvore completa de localizações da empresa
    async findTree(companyId: string) {
        const all = await this.prisma.location.findMany({
            where: { companyId, isActive: true },
            select: {
                id: true,
                name: true,
                parentId: true,
                costCenterId: true,
                description: true,
                _count: { select: { equipments: true } },
            },
            orderBy: { name: 'asc' },
        })

        // Monta a árvore em memória
        const map = new Map(all.map((l) => [l.id, { ...l, children: [] as any[] }]))
        const roots: any[] = []

        for (const node of map.values()) {
            if (node.parentId) {
                const parent = map.get(node.parentId)
                if (parent) parent.children.push(node)
                else roots.push(node) // pai inativo — sobe para raiz
            } else {
                roots.push(node)
            }
        }

        return roots
    }

    async findOne(id: string, companyId: string) {
        const location = await this.prisma.location.findFirst({
            where: { id, companyId },
            select: LOCATION_SELECT,
        })

        if (!location) throw new NotFoundException('Localização não encontrada')

        return location
    }

    async create(
        dto: CreateLocationDto,
        companyId: string,
    ) {
        // Valida parentId pertence à mesma empresa
        if (dto.parentId) {
            const parent = await this.prisma.location.findFirst({
                where: { id: dto.parentId, companyId },
                select: { id: true },
            })
            if (!parent) {
                throw new BadRequestException('Localização pai não encontrada nesta empresa')
            }
        }

        // Valida costCenterId pertence à mesma empresa
        if (dto.costCenterId) {
            const cc = await this.prisma.costCenter.findFirst({
                where: { id: dto.costCenterId, companyId },
                select: { id: true },
            })
            if (!cc) {
                throw new BadRequestException('Centro de custo não encontrado nesta empresa')
            }
        }

        return this.prisma.location.create({
            data: {
                companyId,
                name: dto.name,
                description: dto.description,
                parentId: dto.parentId ?? null,
                costCenterId: dto.costCenterId ?? null,
            },
            select: LOCATION_SELECT,
        })
    }

    async update(
        id: string,
        dto: UpdateLocationDto,
        companyId: string,
    ) {
        const existing = await this.prisma.location.findFirst({
            where: { id, companyId },
            select: { id: true },
        })

        if (!existing) throw new NotFoundException('Localização não encontrada')

        // Impede que um nó seja pai de si mesmo
        if (dto.parentId === id) {
            throw new BadRequestException(
                'Uma localização não pode ser pai de si mesma',
            )
        }

        return this.prisma.location.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.parentId !== undefined && { parentId: dto.parentId }),
                ...(dto.costCenterId !== undefined && { costCenterId: dto.costCenterId }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: LOCATION_SELECT,
        })
    }

    async remove(id: string, companyId: string) {
        const location = await this.prisma.location.findFirst({
            where: { id, companyId },
            select: {
                id: true,
                name: true,
                _count: { select: { equipments: true, children: true } },
            },
        })

        if (!location) throw new NotFoundException('Localização não encontrada')

        if (location._count.equipments > 0) {
            throw new ConflictException(
                `Não é possível remover — ${location._count.equipments} equipamento(s) nesta localização`,
            )
        }

        if (location._count.children > 0) {
            throw new ConflictException(
                `Não é possível remover — esta localização possui sublocalizações`,
            )
        }

        await this.prisma.location.delete({ where: { id } })

        return { message: 'Localização removida com sucesso' }
    }
}
