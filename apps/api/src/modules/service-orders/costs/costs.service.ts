import {
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateCostItemDto, UpdateCostItemDto } from './dto/cost.dto'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Decimal } = require('decimal.js')

const COST_ITEM_SELECT = {
    id: true,
    description: true,
    type: true,
    quantity: true,
    unitPrice: true,
    totalPrice: true,
    notes: true,
    createdAt: true,
} as const

/** Converte campos Decimal do Prisma para number puro antes de retornar ao cliente */
function normalizeItem(item: {
    id: string
    description: string
    type: string
    quantity: unknown
    unitPrice: unknown
    totalPrice: unknown
    notes: string | null
    createdAt: Date
}) {
    return {
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
    }
}

@Injectable()
export class CostsService {
    constructor(private prisma: PrismaService) { }

    private async validateServiceOrder(serviceOrderId: string, clientId: string | null, companyId: string) {
        const os = await this.prisma.serviceOrder.findFirst({
            where: {
                id: serviceOrderId,
                companyId,
                deletedAt: null,
                ...(clientId && { OR: [{ clientId }, { clientId: null }] }),
            },
            select: { id: true },
        })
        if (!os) throw new NotFoundException('Ordem de serviço não encontrada')
        return os
    }

    async findAll(serviceOrderId: string, clientId: string | null, companyId: string) {
        await this.validateServiceOrder(serviceOrderId, clientId, companyId)

        const raw = await this.prisma.serviceOrderCostItem.findMany({
            where: { serviceOrderId },
            select: COST_ITEM_SELECT,
            orderBy: { createdAt: 'asc' },
        })

        const items = raw.map(normalizeItem)
        const total = items.reduce((sum, item) => sum + item.totalPrice, 0)

        return { items, total }
    }

    async create(
        serviceOrderId: string,
        dto: CreateCostItemDto,
        clientId: string | null,
        companyId: string,
    ) {
        await this.validateServiceOrder(serviceOrderId, clientId, companyId)

        const totalPrice = new Decimal(dto.quantity).mul(new Decimal(dto.unitPrice))

        const item = await this.prisma.$transaction(async (tx) => {
            const created = await tx.serviceOrderCostItem.create({
                data: {
                    serviceOrderId,
                    description: dto.description,
                    type: dto.type,
                    quantity: new Decimal(dto.quantity),
                    unitPrice: new Decimal(dto.unitPrice),
                    totalPrice,
                    notes: dto.notes,
                },
                select: COST_ITEM_SELECT,
            })

            await this.recalculateTotalCost(tx, serviceOrderId)

            return created
        })

        return normalizeItem(item)
    }

    async update(
        costItemId: string,
        dto: UpdateCostItemDto,
        companyId: string,
    ) {
        const item = await this.prisma.serviceOrderCostItem.findFirst({
            where: {
                id: costItemId,
                serviceOrder: { companyId, deletedAt: null },
            },
            select: { id: true, serviceOrderId: true, quantity: true, unitPrice: true },
        })
        if (!item) throw new NotFoundException('Item de custo não encontrado')

        const newQuantity = dto.quantity !== undefined
            ? new Decimal(dto.quantity)
            : new Decimal(item.quantity.toString())
        const newUnitPrice = dto.unitPrice !== undefined
            ? new Decimal(dto.unitPrice)
            : new Decimal(item.unitPrice.toString())
        const totalPrice = newQuantity.mul(newUnitPrice)

        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.serviceOrderCostItem.update({
                where: { id: costItemId },
                data: {
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.type !== undefined && { type: dto.type }),
                    quantity: newQuantity,
                    unitPrice: newUnitPrice,
                    totalPrice,
                    ...(dto.notes !== undefined && { notes: dto.notes }),
                },
                select: COST_ITEM_SELECT,
            })

            await this.recalculateTotalCost(tx, item.serviceOrderId)

            return result
        })

        return normalizeItem(updated)
    }

    async remove(costItemId: string, companyId: string) {
        const item = await this.prisma.serviceOrderCostItem.findFirst({
            where: {
                id: costItemId,
                serviceOrder: { companyId, deletedAt: null },
            },
            select: { id: true, serviceOrderId: true },
        })
        if (!item) throw new NotFoundException('Item de custo não encontrado')

        await this.prisma.$transaction(async (tx) => {
            await tx.serviceOrderCostItem.delete({ where: { id: costItemId } })
            await this.recalculateTotalCost(tx, item.serviceOrderId)
        })

        return { message: 'Item de custo removido com sucesso' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async recalculateTotalCost(tx: any, serviceOrderId: string) {
        const agg = await tx.serviceOrderCostItem.aggregate({
            where: { serviceOrderId },
            _sum: { totalPrice: true },
        })
        await tx.serviceOrder.update({
            where: { id: serviceOrderId },
            data: { totalCost: agg._sum.totalPrice ?? new Decimal(0) },
        })
    }
}
