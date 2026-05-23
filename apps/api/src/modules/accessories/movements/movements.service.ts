import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common'
import { AccessoryStatus, MovementStatus, MovementType } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { CreateAccessoryMovementDto, ReturnAccessoryMovementDto } from './dto/movement.dto'

@Injectable()
export class AccessoryMovementsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(accessoryId: string, companyId: string) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        return this.prisma.accessoryMovement.findMany({
            where: { accessoryId, companyId },
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
        accessoryId: string,
        dto: CreateAccessoryMovementDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        // Verifica acessório
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true, status: true, currentLocationId: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        // Acessórios baixados ou extraviados não podem ser movimentados
        if (accessory.status === AccessoryStatus.SCRAPPED) {
            throw new BadRequestException('Acessório baixado (SCRAPPED) não pode ser movimentado')
        }
        if (accessory.status === AccessoryStatus.LOST) {
            throw new BadRequestException('Acessório extraviado (LOST) não pode ser movimentado')
        }

        // Verifica movimentação ativa
        const activeMovement = await this.prisma.accessoryMovement.findFirst({
            where: { accessoryId, status: MovementStatus.ACTIVE },
            select: { id: true },
        })
        if (activeMovement) {
            throw new ConflictException('Acessório já possui uma movimentação ativa')
        }

        // Valida localizações (mesmo tenant)
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

        // LOAN exige data de devolução
        if (dto.type === MovementType.LOAN && !dto.expectedReturnAt) {
            throw new BadRequestException('Empréstimos exigem data de devolução prevista')
        }

        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.accessoryMovement.create({
                data: {
                    companyId,
                    accessoryId,
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

            // Atualiza localização atual do acessório
            await tx.accessory.update({
                where: { id: accessoryId },
                data: { currentLocationId: dto.destinationLocationId },
            })

            return movement
        })
    }

    async returnAccessory(
        movementId: string,
        dto: ReturnAccessoryMovementDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const movement = await this.prisma.accessoryMovement.findFirst({
            where: { id: movementId, companyId, status: MovementStatus.ACTIVE },
            select: { id: true, accessoryId: true, type: true, originLocationId: true },
        })
        if (!movement) throw new NotFoundException('Movimentação não encontrada ou já encerrada')

        if (movement.type !== MovementType.LOAN) {
            throw new BadRequestException('Apenas empréstimos podem ser devolvidos')
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.accessoryMovement.update({
                where: { id: movementId },
                data: {
                    status: MovementStatus.RETURNED,
                    returnedAt: new Date(),
                    approverId: currentUser.sub,
                    notes: dto.notes,
                },
            })

            // Volta para localização de origem
            await tx.accessory.update({
                where: { id: movement.accessoryId },
                data: { currentLocationId: movement.originLocationId },
            })

            return updated
        })
    }
}
