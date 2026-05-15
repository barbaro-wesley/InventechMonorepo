import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { EventType } from '../notifications/notifications.constants'
import { CreateStockItemDto, ListStockItemsDto, UpdateStockItemDto } from './dto/stock-item.dto'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Decimal } = require('decimal.js')

const ITEM_SELECT = {
    id: true,
    companyId: true,
    stockPointId: true,
    categoryId: true,
    code: true,
    name: true,
    description: true,
    unit: true,
    brand: true,
    minimumQuantity: true,
    currentQuantity: true,
    unitCost: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    stockPoint: { select: { id: true, name: true } },
    category: { select: { id: true, name: true, color: true } },
} satisfies Prisma.StockItemSelect

function normalizeItem(item: any) {
    return {
        ...item,
        minimumQuantity: Number(item.minimumQuantity),
        currentQuantity: Number(item.currentQuantity),
        unitCost: item.unitCost !== null ? Number(item.unitCost) : null,
    }
}

@Injectable()
export class InventoryService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) {}

    async findAll(companyId: string, filters: ListStockItemsDto) {
        const { stockPointId, categoryId, search, isActive, belowMinimum, page = 1, limit = 50 } = filters

        const where: Prisma.StockItemWhereInput = {
            companyId,
            ...(stockPointId && { stockPointId }),
            ...(categoryId && { categoryId }),
            ...(isActive !== undefined && { isActive }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                    { brand: { contains: search, mode: 'insensitive' } },
                ],
            }),
        }

        if (belowMinimum) {
            const baseWhere: Prisma.StockItemWhereInput = {
                companyId,
                ...(stockPointId && { stockPointId }),
                ...(categoryId && { categoryId }),
                ...(isActive !== undefined && { isActive }),
                minimumQuantity: { gt: 0 },
            }
            const allItems = await this.prisma.stockItem.findMany({
                where: baseWhere,
                select: ITEM_SELECT,
            })
            const filtered = allItems
                .map(normalizeItem)
                .filter((i) => i.currentQuantity < i.minimumQuantity)
            return { data: filtered, pagination: { page: 1, limit: filtered.length, total: filtered.length } }
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.stockItem.findMany({
                where,
                select: ITEM_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.stockItem.count({ where }),
        ])

        return { data: data.map(normalizeItem), pagination: { page, limit, total } }
    }

    async findOne(id: string, companyId: string) {
        const item = await this.prisma.stockItem.findFirst({
            where: { id, companyId },
            select: ITEM_SELECT,
        })
        if (!item) throw new NotFoundException('Item de estoque não encontrado')
        return normalizeItem(item)
    }

    async create(dto: CreateStockItemDto, companyId: string) {
        const point = await this.prisma.stockPoint.findFirst({
            where: { id: dto.stockPointId, companyId },
            select: { id: true },
        })
        if (!point) throw new NotFoundException('Ponto de estoque não encontrado')

        if (dto.code) {
            const existing = await this.prisma.stockItem.findFirst({
                where: { stockPointId: dto.stockPointId, code: dto.code },
                select: { id: true },
            })
            if (existing) throw new ConflictException('Já existe um item com este código neste ponto de estoque')
        }

        const item = await this.prisma.stockItem.create({
            data: {
                companyId,
                stockPointId: dto.stockPointId,
                categoryId: dto.categoryId ?? null,
                code: dto.code ?? null,
                name: dto.name,
                description: dto.description ?? null,
                unit: dto.unit ?? 'UN',
                brand: dto.brand ?? null,
                minimumQuantity: dto.minimumQuantity !== undefined ? new Decimal(dto.minimumQuantity) : new Decimal(0),
                unitCost: dto.unitCost !== undefined ? new Decimal(dto.unitCost) : null,
            },
            select: ITEM_SELECT,
        })

        return normalizeItem(item)
    }

    async update(id: string, dto: UpdateStockItemDto, companyId: string) {
        const item = await this.prisma.stockItem.findFirst({
            where: { id, companyId },
            select: { id: true, stockPointId: true, code: true },
        })
        if (!item) throw new NotFoundException('Item de estoque não encontrado')

        if (dto.code && dto.code !== item.code) {
            const existing = await this.prisma.stockItem.findFirst({
                where: { stockPointId: item.stockPointId, code: dto.code, id: { not: id } },
                select: { id: true },
            })
            if (existing) throw new ConflictException('Já existe um item com este código neste ponto de estoque')
        }

        const updated = await this.prisma.stockItem.update({
            where: { id },
            data: {
                ...(dto.categoryId !== undefined && { categoryId: dto.categoryId ?? null }),
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.unit !== undefined && { unit: dto.unit }),
                ...(dto.brand !== undefined && { brand: dto.brand }),
                ...(dto.minimumQuantity !== undefined && { minimumQuantity: new Decimal(dto.minimumQuantity) }),
                ...(dto.unitCost !== undefined && { unitCost: new Decimal(dto.unitCost) }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: ITEM_SELECT,
        })

        return normalizeItem(updated)
    }

    async remove(id: string, companyId: string) {
        const item = await this.prisma.stockItem.findFirst({
            where: { id, companyId },
            select: { id: true, currentQuantity: true },
        })
        if (!item) throw new NotFoundException('Item de estoque não encontrado')

        if (Number(item.currentQuantity) > 0) {
            throw new BadRequestException('Não é possível remover um item com estoque maior que zero. Ajuste o estoque primeiro.')
        }

        await this.prisma.stockItem.delete({ where: { id } })
        return { message: 'Item de estoque removido com sucesso' }
    }

    async applyMovement(
        itemId: string,
        companyId: string,
        userId: string,
        stockPointId: string,
        type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT',
        quantity: number,
        opts?: { unitCost?: number; reason?: string; notes?: string; serviceOrderId?: string },
    ) {
        const item = await this.prisma.stockItem.findFirst({
            where: { id: itemId, companyId, stockPointId },
            select: { id: true, currentQuantity: true, minimumQuantity: true, name: true, code: true, unit: true, stockPoint: { select: { name: true } } },
        })
        if (!item) throw new NotFoundException('Item de estoque não encontrado neste ponto')

        const current = new Decimal(item.currentQuantity.toString())
        const qty = new Decimal(quantity)

        let newQuantity: typeof current
        if (type === 'ENTRY') {
            newQuantity = current.plus(qty)
        } else if (type === 'EXIT') {
            newQuantity = current.minus(qty)
            if (newQuantity.lt(0)) {
                throw new BadRequestException(`Estoque insuficiente. Disponível: ${current.toString()} ${item.unit}`)
            }
        } else {
            newQuantity = qty
        }

        const movement = await this.prisma.$transaction(async (tx) => {
            const mov = await tx.stockMovement.create({
                data: {
                    companyId,
                    stockPointId,
                    itemId,
                    userId,
                    type,
                    quantity: qty,
                    quantityBefore: current,
                    quantityAfter: newQuantity,
                    ...(opts?.unitCost !== undefined && { unitCost: new Decimal(opts.unitCost) }),
                    reason: opts?.reason ?? null,
                    notes: opts?.notes ?? null,
                    serviceOrderId: opts?.serviceOrderId ?? null,
                },
                select: {
                    id: true, type: true, quantity: true,
                    quantityBefore: true, quantityAfter: true,
                    unitCost: true, reason: true, notes: true, createdAt: true,
                },
            })

            await tx.stockItem.update({
                where: { id: itemId },
                data: { currentQuantity: newQuantity },
            })

            return mov
        })

        const minQty = new Decimal(item.minimumQuantity.toString())
        if (minQty.gt(0) && newQuantity.lt(minQty)) {
            await this.notificationsService.notify({
                event: EventType.STOCK_LOW_QUANTITY,
                companyId,
                data: {
                    itemId,
                    itemName: item.name,
                    itemCode: item.code,
                    unit: item.unit,
                    currentQuantity: newQuantity.toFixed(3),
                    minimumQuantity: minQty.toFixed(3),
                    stockPointName: item.stockPoint?.name ?? null,
                },
            })
        }

        return {
            ...movement,
            quantity: Number(movement.quantity),
            quantityBefore: Number(movement.quantityBefore),
            quantityAfter: Number(movement.quantityAfter),
            unitCost: movement.unitCost !== null ? Number(movement.unitCost) : null,
        }
    }

    async applyTransfer(
        sourceItemId: string,
        destinationPointId: string,
        companyId: string,
        userId: string,
        quantity: number,
        opts?: { unitCost?: number; reason?: string; notes?: string },
    ) {
        const sourceItem = await this.prisma.stockItem.findFirst({
            where: { id: sourceItemId, companyId },
            select: {
                id: true, stockPointId: true, currentQuantity: true, minimumQuantity: true,
                name: true, code: true, unit: true, brand: true, categoryId: true,
                description: true, unitCost: true,
            },
        })
        if (!sourceItem) throw new NotFoundException('Item de estoque de origem não encontrado')

        const destPoint = await this.prisma.stockPoint.findFirst({
            where: { id: destinationPointId, companyId },
            select: { id: true },
        })
        if (!destPoint) throw new NotFoundException('Ponto de estoque destino não encontrado')

        if (sourceItem.stockPointId === destinationPointId) {
            throw new BadRequestException('Origem e destino não podem ser o mesmo ponto')
        }

        const sourceQty = new Decimal(sourceItem.currentQuantity.toString())
        const qty = new Decimal(quantity)

        if (sourceQty.lt(qty)) {
            throw new BadRequestException(`Estoque insuficiente. Disponível: ${sourceQty.toString()} ${sourceItem.unit}`)
        }

        const sourceNewQty = sourceQty.minus(qty)

        // Busca ou cria o item no ponto destino
        let destItem = await this.prisma.stockItem.findFirst({
            where: { stockPointId: destinationPointId, name: sourceItem.name, code: sourceItem.code },
            select: { id: true, currentQuantity: true },
        })

        const destCurrentQty = destItem ? new Decimal(destItem.currentQuantity.toString()) : new Decimal(0)
        const destNewQty = destCurrentQty.plus(qty)

        await this.prisma.$transaction(async (tx) => {
            // Cria item no destino se não existir
            if (!destItem) {
                destItem = await tx.stockItem.create({
                    data: {
                        companyId,
                        stockPointId: destinationPointId,
                        name: sourceItem.name,
                        code: sourceItem.code,
                        description: sourceItem.description,
                        unit: sourceItem.unit,
                        brand: sourceItem.brand,
                        categoryId: sourceItem.categoryId,
                        unitCost: sourceItem.unitCost,
                        currentQuantity: new Decimal(0),
                        minimumQuantity: new Decimal(0),
                    },
                    select: { id: true, currentQuantity: true },
                })
            }

            // Movimento EXIT no ponto origem
            await tx.stockMovement.create({
                data: {
                    companyId,
                    stockPointId: sourceItem.stockPointId,
                    itemId: sourceItem.id,
                    userId,
                    type: 'TRANSFER',
                    quantity: qty,
                    quantityBefore: sourceQty,
                    quantityAfter: sourceNewQty,
                    destinationPointId,
                    reason: opts?.reason ?? null,
                    notes: opts?.notes ?? null,
                },
            })

            // Movimento ENTRY no ponto destino
            await tx.stockMovement.create({
                data: {
                    companyId,
                    stockPointId: destinationPointId,
                    itemId: destItem!.id,
                    userId,
                    type: 'TRANSFER',
                    quantity: qty,
                    quantityBefore: destCurrentQty,
                    quantityAfter: destNewQty,
                    reason: opts?.reason ?? null,
                    notes: opts?.notes ?? null,
                },
            })

            // Atualiza quantidades
            await tx.stockItem.update({ where: { id: sourceItem.id }, data: { currentQuantity: sourceNewQty } })
            await tx.stockItem.update({ where: { id: destItem!.id }, data: { currentQuantity: destNewQty } })
        })

        return { message: 'Transferência realizada com sucesso', quantity: Number(qty) }
    }
}
