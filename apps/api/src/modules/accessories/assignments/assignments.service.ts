import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common'
import { AccessoryStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { AssignAccessoryDto, UnassignAccessoryDto } from './dto/assignment.dto'

@Injectable()
export class AssignmentsService {
    constructor(private readonly prisma: PrismaService) { }

    async findByAccessory(accessoryId: string, companyId: string) {
        // Valida pertencimento do acessório ao tenant
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        return this.prisma.accessoryAssignment.findMany({
            where: { accessoryId },
            orderBy: { assignedAt: 'desc' },
            include: {
                equipment: { select: { id: true, name: true, serialNumber: true } },
                assignedBy: { select: { id: true, name: true } },
                unassignedBy: { select: { id: true, name: true } },
            },
        })
    }

    async findByEquipment(equipmentId: string, companyId: string) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: equipmentId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        return this.prisma.accessoryAssignment.findMany({
            where: { equipmentId, companyId },
            orderBy: { assignedAt: 'desc' },
            include: {
                accessory: {
                    select: {
                        id: true, name: true, serialNumber: true, patrimonyNumber: true,
                        status: true, category: { select: { id: true, name: true, color: true } },
                    },
                },
                assignedBy: { select: { id: true, name: true } },
                unassignedBy: { select: { id: true, name: true } },
            },
        })
    }

    /**
     * Vincula um acessório a um equipamento.
     * Executa em transação: cria assignment + atualiza status do acessório + registra histórico.
     */
    async assign(
        accessoryId: string,
        dto: AssignAccessoryDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        // Verifica acessório
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true, name: true, status: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        // Não pode vincular acessório baixado
        if (accessory.status === AccessoryStatus.SCRAPPED) {
            throw new BadRequestException('Acessório baixado (SCRAPPED) não pode ser vinculado')
        }
        if (accessory.status === AccessoryStatus.LOST) {
            throw new BadRequestException('Acessório extraviado (LOST) não pode ser vinculado')
        }
        if (accessory.status === AccessoryStatus.IN_USE) {
            throw new ConflictException('Acessório já está vinculado a um equipamento')
        }

        // Verifica equipamento (mesmo tenant)
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: dto.equipmentId, companyId, deletedAt: null },
            select: { id: true, name: true, brand: true, model: true, serialNumber: true },
        })
        if (!equipment) throw new BadRequestException('Equipamento não encontrado nesta empresa')

        return this.prisma.$transaction(async (tx) => {
            // Cria o vínculo
            const assignment = await tx.accessoryAssignment.create({
                data: {
                    companyId,
                    accessoryId,
                    equipmentId: dto.equipmentId,
                    assignedById: currentUser.sub,
                    reason: dto.reason,
                    notes: dto.notes,
                    isActive: true,
                    equipmentSnapshot: {
                        id: equipment.id,
                        name: equipment.name,
                        brand: equipment.brand,
                        model: equipment.model,
                        serialNumber: equipment.serialNumber,
                    },
                },
                include: {
                    equipment: { select: { id: true, name: true } },
                    assignedBy: { select: { id: true, name: true } },
                },
            })

            // Atualiza estado desnormalizado do acessório
            await tx.accessory.update({
                where: { id: accessoryId },
                data: {
                    status: AccessoryStatus.IN_USE,
                    currentEquipmentId: dto.equipmentId,
                },
            })

            // Registra histórico de status
            await tx.accessoryStatusHistory.create({
                data: {
                    accessoryId,
                    fromStatus: accessory.status,
                    toStatus: AccessoryStatus.IN_USE,
                    changedById: currentUser.sub,
                    reason: dto.reason ?? 'Vínculo a equipamento',
                    metadata: { assignmentId: assignment.id, equipmentId: dto.equipmentId },
                },
            })

            return assignment
        })
    }

    /**
     * Desvincula um acessório do equipamento atual.
     * Executa em transação: fecha assignment + atualiza status + registra histórico.
     */
    async unassign(
        accessoryId: string,
        dto: UnassignAccessoryDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true, status: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        // Busca o vínculo ativo
        const activeAssignment = await this.prisma.accessoryAssignment.findFirst({
            where: { accessoryId, isActive: true },
            select: { id: true },
        })
        if (!activeAssignment) {
            throw new ConflictException('Acessório não possui vínculo ativo')
        }

        return this.prisma.$transaction(async (tx) => {
            // Fecha o vínculo
            const assignment = await tx.accessoryAssignment.update({
                where: { id: activeAssignment.id },
                data: {
                    isActive: false,
                    unassignedAt: new Date(),
                    unassignedById: currentUser.sub,
                    unassignReason: dto.unassignReason,
                },
            })

            // Atualiza estado desnormalizado do acessório
            await tx.accessory.update({
                where: { id: accessoryId },
                data: {
                    status: AccessoryStatus.AVAILABLE,
                    currentEquipmentId: null,
                },
            })

            // Registra histórico de status
            await tx.accessoryStatusHistory.create({
                data: {
                    accessoryId,
                    fromStatus: accessory.status,
                    toStatus: AccessoryStatus.AVAILABLE,
                    changedById: currentUser.sub,
                    reason: dto.unassignReason ?? 'Desvinculação de equipamento',
                    metadata: { assignmentId: activeAssignment.id },
                },
            })

            return assignment
        })
    }
}
