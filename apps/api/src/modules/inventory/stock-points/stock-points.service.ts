import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import {
    AssignClientsDto,
    CreateStockPointDto,
    ListStockPointsDto,
    UpdateStockPointDto,
} from './dto/stock-point.dto'

const POINT_SELECT = {
    id: true,
    companyId: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    clients: {
        select: {
            client: { select: { id: true, name: true } },
            createdAt: true,
        },
    },
    _count: { select: { items: true } },
}

@Injectable()
export class StockPointsService {
    constructor(private prisma: PrismaService) {}

    async findAll(companyId: string, filters: ListStockPointsDto) {
        const { search, isActive, clientId } = filters

        const points = await this.prisma.stockPoint.findMany({
            where: {
                companyId,
                ...(isActive !== undefined && { isActive }),
                ...(search && { name: { contains: search, mode: 'insensitive' } }),
                ...(clientId && { clients: { some: { clientId } } }),
            },
            select: POINT_SELECT,
            orderBy: { name: 'asc' },
        })

        return points.map(this.format)
    }

    async findOne(id: string, companyId: string) {
        const point = await this.prisma.stockPoint.findFirst({
            where: { id, companyId },
            select: {
                ...POINT_SELECT,
                items: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        unit: true,
                        currentQuantity: true,
                        minimumQuantity: true,
                        category: { select: { id: true, name: true, color: true } },
                    },
                    orderBy: { name: 'asc' },
                },
            },
        })
        if (!point) throw new NotFoundException('Ponto de estoque não encontrado')
        return {
            ...this.format(point),
            items: point.items.map((i) => ({
                ...i,
                currentQuantity: Number(i.currentQuantity),
                minimumQuantity: Number(i.minimumQuantity),
            })),
        }
    }

    async create(dto: CreateStockPointDto, companyId: string) {
        const existing = await this.prisma.stockPoint.findFirst({
            where: { companyId, name: dto.name },
            select: { id: true },
        })
        if (existing) throw new ConflictException('Já existe um ponto de estoque com este nome')

        if (dto.clientIds?.length) {
            const count = await this.prisma.client.count({
                where: { id: { in: dto.clientIds }, companyId },
            })
            if (count !== dto.clientIds.length) throw new NotFoundException('Um ou mais clientes não encontrados')
        }

        const point = await this.prisma.stockPoint.create({
            data: {
                companyId,
                name: dto.name,
                description: dto.description ?? null,
                ...(dto.clientIds?.length && {
                    clients: {
                        create: dto.clientIds.map((clientId) => ({ clientId })),
                    },
                }),
            },
            select: POINT_SELECT,
        })

        return this.format(point)
    }

    async update(id: string, dto: UpdateStockPointDto, companyId: string) {
        const point = await this.prisma.stockPoint.findFirst({
            where: { id, companyId },
            select: { id: true, name: true },
        })
        if (!point) throw new NotFoundException('Ponto de estoque não encontrado')

        if (dto.name && dto.name !== point.name) {
            const existing = await this.prisma.stockPoint.findFirst({
                where: { companyId, name: dto.name, id: { not: id } },
                select: { id: true },
            })
            if (existing) throw new ConflictException('Já existe um ponto de estoque com este nome')
        }

        const updated = await this.prisma.stockPoint.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: POINT_SELECT,
        })

        return this.format(updated)
    }

    async remove(id: string, companyId: string) {
        const point = await this.prisma.stockPoint.findFirst({
            where: { id, companyId },
            select: { id: true, _count: { select: { items: true } } },
        })
        if (!point) throw new NotFoundException('Ponto de estoque não encontrado')
        if (point._count.items > 0) {
            throw new BadRequestException('Não é possível remover um ponto que possui itens vinculados')
        }

        await this.prisma.$transaction([
            this.prisma.stockPointClient.deleteMany({ where: { stockPointId: id } }),
            this.prisma.stockPoint.delete({ where: { id } }),
        ])

        return { message: 'Ponto de estoque removido com sucesso' }
    }

    async assignClients(id: string, dto: AssignClientsDto, companyId: string) {
        const point = await this.prisma.stockPoint.findFirst({
            where: { id, companyId },
            select: { id: true },
        })
        if (!point) throw new NotFoundException('Ponto de estoque não encontrado')

        const count = await this.prisma.client.count({
            where: { id: { in: dto.clientIds }, companyId },
        })
        if (count !== dto.clientIds.length) throw new NotFoundException('Um ou mais clientes não encontrados')

        await this.prisma.$transaction([
            this.prisma.stockPointClient.deleteMany({ where: { stockPointId: id } }),
            this.prisma.stockPointClient.createMany({
                data: dto.clientIds.map((clientId) => ({ stockPointId: id, clientId })),
                skipDuplicates: true,
            }),
        ])

        const updated = await this.prisma.stockPoint.findFirst({
            where: { id },
            select: POINT_SELECT,
        })
        return this.format(updated!)
    }

    private format(point: any) {
        return {
            ...point,
            clients: point.clients.map((pc: any) => pc.client),
        }
    }
}
