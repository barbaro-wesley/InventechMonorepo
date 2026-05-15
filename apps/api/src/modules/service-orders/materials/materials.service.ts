import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator'
import { Type } from 'class-transformer'
import { PrismaService } from '../../../prisma/prisma.service'
import { InventoryService } from '../../inventory/inventory.service'

export class AddMaterialDto {
    @IsUUID()
    stockPointId: string

    @IsUUID()
    itemId: string

    @IsNumber({ maxDecimalPlaces: 3 })
    @IsPositive()
    @Type(() => Number)
    quantity: number

    @IsOptional()
    @IsString()
    notes?: string
}

const MOVEMENT_SELECT = {
    id: true,
    type: true,
    quantity: true,
    quantityBefore: true,
    quantityAfter: true,
    unitCost: true,
    reason: true,
    notes: true,
    createdAt: true,
    item: { select: { id: true, name: true, code: true, unit: true } },
    stockPoint: { select: { id: true, name: true } },
    user: { select: { id: true, name: true } },
} as const

function normalize(m: any) {
    return {
        ...m,
        quantity: Number(m.quantity),
        quantityBefore: Number(m.quantityBefore),
        quantityAfter: Number(m.quantityAfter),
        unitCost: m.unitCost !== null ? Number(m.unitCost) : null,
    }
}

@Injectable()
export class MaterialsService {
    constructor(
        private prisma: PrismaService,
        private inventoryService: InventoryService,
    ) {}

    private async validateOs(serviceOrderId: string, companyId: string) {
        const os = await this.prisma.serviceOrder.findFirst({
            where: { id: serviceOrderId, companyId, deletedAt: null },
            select: { id: true, status: true },
        })
        if (!os) throw new NotFoundException('Ordem de serviço não encontrada')
        if (os.status === 'CANCELLED' || os.status === 'COMPLETED_APPROVED') {
            throw new BadRequestException('Não é possível registrar materiais em uma OS cancelada ou aprovada')
        }
        return os
    }

    async findAll(serviceOrderId: string, companyId: string) {
        await this.validateOs(serviceOrderId, companyId)

        const movements = await this.prisma.stockMovement.findMany({
            where: { serviceOrderId, companyId },
            select: MOVEMENT_SELECT,
            orderBy: { createdAt: 'asc' },
        })

        const items = movements.map(normalize)
        const totalCost = items.reduce((sum, m) => {
            if (m.unitCost !== null) return sum + m.unitCost * m.quantity
            return sum
        }, 0)

        return { items, totalCost }
    }

    async create(
        serviceOrderId: string,
        dto: AddMaterialDto,
        companyId: string,
        userId: string,
        clientId?: string,
    ) {
        await this.validateOs(serviceOrderId, companyId)

        const item = await this.prisma.stockItem.findFirst({
            where: { id: dto.itemId, stockPointId: dto.stockPointId, companyId },
            select: { id: true, name: true, stockPointId: true, currentQuantity: true, unitCost: true, unit: true },
        })
        if (!item) throw new NotFoundException('Item não encontrado neste ponto de estoque')

        if (Number(item.currentQuantity) < dto.quantity) {
            throw new BadRequestException(
                `Quantidade insuficiente. Disponível: ${Number(item.currentQuantity)} ${item.unit}`,
            )
        }

        // Prestadores só podem usar itens de pontos vinculados a eles
        if (clientId) {
            const linked = await this.prisma.stockPointClient.findUnique({
                where: { stockPointId_clientId: { stockPointId: dto.stockPointId, clientId } },
                select: { stockPointId: true },
            })
            if (!linked) {
                throw new ForbiddenException('Ponto de estoque não vinculado a este prestador')
            }
        }

        const movement = await this.inventoryService.applyMovement(
            dto.itemId,
            companyId,
            userId,
            dto.stockPointId,
            'EXIT',
            dto.quantity,
            {
                unitCost: item.unitCost ? Number(item.unitCost) : undefined,
                reason: `Uso em OS`,
                notes: dto.notes,
                serviceOrderId,
            },
        )

        return movement
    }

    async remove(movementId: string, serviceOrderId: string, companyId: string) {
        const movement = await this.prisma.stockMovement.findFirst({
            where: { id: movementId, serviceOrderId, companyId, type: 'EXIT' },
            select: { id: true, itemId: true, quantity: true, stockPointId: true },
        })
        if (!movement) throw new NotFoundException('Registro de material não encontrado')

        // Estorna a quantidade e remove o movimento em uma única transação
        await this.prisma.$transaction([
            this.prisma.stockItem.update({
                where: { id: movement.itemId },
                data: { currentQuantity: { increment: movement.quantity } },
            }),
            this.prisma.stockMovement.delete({ where: { id: movementId } }),
        ])

        return { message: 'Material removido e estoque revertido' }
    }
}
