import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common'
import { EquipmentStatus, MovementStatus, MovementType } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { CreateMovementDto, ReturnMovementDto } from './dto/movement.dto'

@Injectable()
export class MovementsService {
    constructor(private prisma: PrismaService) { }

    async findAll(equipmentId: string, companyId: string) {
        return this.prisma.equipmentMovement.findMany({
            where: { equipmentId, companyId },
            orderBy: { createdAt: 'desc' },
            include: {
                origin: { select: { id: true, name: true } },
                destination: { select: { id: true, name: true } },
                requester: { select: { id: true, name: true } },
                approver: { select: { id: true, name: true } },
            },
        })
    }

    async create(
        equipmentId: string,
        dto: CreateMovementDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        // Verifica equipamento
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: equipmentId, companyId, deletedAt: null },
            select: { id: true, name: true, status: true, currentLocationId: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        // Equipamento em manutenção não pode ser movimentado
        if (equipment.status === EquipmentStatus.UNDER_MAINTENANCE) {
            throw new ConflictException('Equipamento está em manutenção e não pode ser movimentado')
        }

        // Já tem movimentação ativa?
        const activeMovement = await this.prisma.equipmentMovement.findFirst({
            where: { equipmentId, status: MovementStatus.ACTIVE },
            select: { id: true },
        })
        if (activeMovement) {
            throw new ConflictException('Equipamento já possui uma movimentação em andamento')
        }

        // Origem e destino pertencem à mesma empresa
        const [origin, destination] = await Promise.all([
            this.prisma.location.findFirst({
                where: { id: dto.originLocationId, companyId },
                select: { id: true, name: true },
            }),
            this.prisma.location.findFirst({
                where: { id: dto.destinationLocationId, companyId },
                select: { id: true, name: true },
            }),
        ])

        if (!origin) throw new BadRequestException('Local de origem não encontrado nesta empresa')
        if (!destination) throw new BadRequestException('Local de destino não encontrado nesta empresa')
        if (dto.originLocationId === dto.destinationLocationId) {
            throw new BadRequestException('Origem e destino não podem ser iguais')
        }

        // LOAN exige data de devolução
        if (dto.type === MovementType.LOAN && !dto.expectedReturnAt) {
            throw new BadRequestException('Empréstimos precisam de data de devolução prevista')
        }

        // destinationCostCenterId só se aplica a TRANSFER
        if (dto.destinationCostCenterId && dto.type === MovementType.LOAN) {
            throw new BadRequestException('Transferência de centro de custo não é permitida em empréstimos')
        }

        if (dto.destinationCostCenterId) {
            const costCenter = await this.prisma.costCenter.findFirst({
                where: { id: dto.destinationCostCenterId, companyId },
                select: { id: true },
            })
            if (!costCenter) throw new BadRequestException('Centro de custo de destino não encontrado nesta empresa')
        }

        // Transação: cria movimento e atualiza localização atual do equipamento
        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.equipmentMovement.create({
                data: {
                    companyId,
                    equipmentId,
                    requesterId: currentUser.sub,
                    type: dto.type,
                    status: MovementStatus.ACTIVE,
                    originLocationId: dto.originLocationId,
                    destinationLocationId: dto.destinationLocationId,
                    reason: dto.reason,
                    expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : null,
                    notes: dto.notes,
                },
                include: {
                    origin: { select: { id: true, name: true } },
                    destination: { select: { id: true, name: true } },
                },
            })

            // Atualiza localização atual, status e (opcionalmente) centro de custo do equipamento
            await tx.equipment.update({
                where: { id: equipmentId },
                data: {
                    currentLocationId: dto.destinationLocationId,
                    status: dto.type === MovementType.LOAN
                        ? EquipmentStatus.BORROWED
                        : EquipmentStatus.ACTIVE,
                    ...(dto.type === MovementType.TRANSFER && dto.destinationCostCenterId
                        ? { costCenterId: dto.destinationCostCenterId }
                        : {}),
                },
            })

            return movement
        })
    }

    // Devolução de empréstimo
    async returnEquipment(
        movementId: string,
        dto: ReturnMovementDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const movement = await this.prisma.equipmentMovement.findFirst({
            where: { id: movementId, companyId, status: MovementStatus.ACTIVE },
            select: {
                id: true,
                equipmentId: true,
                type: true,
                originLocationId: true,
            },
        })

        if (!movement) throw new NotFoundException('Movimentação não encontrada ou já encerrada')

        if (movement.type !== MovementType.LOAN) {
            throw new BadRequestException('Apenas empréstimos podem ser devolvidos')
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.equipmentMovement.update({
                where: { id: movementId },
                data: {
                    status: MovementStatus.RETURNED,
                    returnedAt: new Date(),
                    approverId: currentUser.sub,
                    notes: dto.notes,
                },
            })

            // Volta para localização de origem
            await tx.equipment.update({
                where: { id: movement.equipmentId },
                data: {
                    currentLocationId: movement.originLocationId,
                    status: EquipmentStatus.ACTIVE,
                },
            })

            return updated
        })
    }
}
