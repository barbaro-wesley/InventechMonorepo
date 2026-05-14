import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { InventoryService } from '../inventory.service'
import { CreateStockMovementDto, ListStockMovementsDto } from '../dto/stock-movement.dto'

const MOVEMENT_SELECT = {
    id: true,
    companyId: true,
    itemId: true,
    userId: true,
    serviceOrderId: true,
    type: true,
    quantity: true,
    quantityBefore: true,
    quantityAfter: true,
    unitCost: true,
    reason: true,
    notes: true,
    createdAt: true,
    item: { select: { id: true, name: true, code: true, unit: true } },
    user: { select: { id: true, name: true } },
    serviceOrder: { select: { id: true, number: true } },
} satisfies Prisma.StockMovementSelect

function normalizeMovement(m: any) {
    return {
        ...m,
        quantity: Number(m.quantity),
        quantityBefore: Number(m.quantityBefore),
        quantityAfter: Number(m.quantityAfter),
        unitCost: m.unitCost !== null ? Number(m.unitCost) : null,
    }
}

@Injectable()
export class MovementsService {
    constructor(
        private prisma: PrismaService,
        private inventoryService: InventoryService,
    ) {}

    async findAll(companyId: string, filters: ListStockMovementsDto) {
        const { itemId, type, page = 1, limit = 50 } = filters

        const where: Prisma.StockMovementWhereInput = {
            companyId,
            ...(itemId && { itemId }),
            ...(type && { type }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.stockMovement.findMany({
                where,
                select: MOVEMENT_SELECT,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.stockMovement.count({ where }),
        ])

        return { data: data.map(normalizeMovement), pagination: { page, limit, total } }
    }

    async create(dto: CreateStockMovementDto, companyId: string, userId: string) {
        const item = await this.prisma.stockItem.findFirst({
            where: { id: dto.itemId, companyId },
            select: { id: true },
        })
        if (!item) throw new NotFoundException('Item de estoque não encontrado')

        return this.inventoryService.applyMovement(
            dto.itemId,
            companyId,
            userId,
            dto.type,
            dto.quantity,
            { unitCost: dto.unitCost, reason: dto.reason, notes: dto.notes },
        )
    }

    async findByItem(itemId: string, companyId: string, page = 1, limit = 50) {
        const item = await this.prisma.stockItem.findFirst({
            where: { id: itemId, companyId },
            select: { id: true },
        })
        if (!item) throw new NotFoundException('Item de estoque não encontrado')

        const where: Prisma.StockMovementWhereInput = { companyId, itemId }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.stockMovement.findMany({
                where,
                select: MOVEMENT_SELECT,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.stockMovement.count({ where }),
        ])

        return { data: data.map(normalizeMovement), pagination: { page, limit, total } }
    }
}
