import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common'
import { AccessoryStatus } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import {
    CreateAccessoryMaintenanceDto,
    CompleteAccessoryMaintenanceDto,
} from './dto/maintenance.dto'

@Injectable()
export class MaintenancesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(accessoryId: string, companyId: string) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        return this.prisma.accessoryMaintenance.findMany({
            where: { accessoryId, companyId },
            orderBy: { createdAt: 'desc' },
            include: {
                technician: { select: { id: true, name: true } },
                _count: { select: { attachments: true } },
            },
        })
    }

    async findOne(id: string, accessoryId: string, companyId: string) {
        const maintenance = await this.prisma.accessoryMaintenance.findFirst({
            where: { id, accessoryId, companyId },
            include: {
                technician: { select: { id: true, name: true } },
                attachments: true,
            },
        })
        if (!maintenance) throw new NotFoundException('Manutenção não encontrada')
        return maintenance
    }

    async create(
        accessoryId: string,
        dto: CreateAccessoryMaintenanceDto,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id: accessoryId, companyId, deletedAt: null },
            select: { id: true, status: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        if (accessory.status === AccessoryStatus.SCRAPPED) {
            throw new BadRequestException('Acessório baixado não pode ter manutenção criada')
        }

        // Se informou técnico, valida que pertence à mesma empresa
        if (dto.technicianId) {
            const technician = await this.prisma.user.findFirst({
                where: { id: dto.technicianId, companyId, deletedAt: null },
                select: { id: true },
            })
            if (!technician) throw new BadRequestException('Técnico não encontrado nesta empresa')
        }

        return this.prisma.accessoryMaintenance.create({
            data: {
                companyId,
                accessoryId,
                type: dto.type,
                title: dto.title,
                description: dto.description,
                observations: dto.observations,
                technicianId: dto.technicianId,
                scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
                startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
            },
            include: {
                technician: { select: { id: true, name: true } },
            },
        })
    }

    /**
     * Conclui uma manutenção.
     * Executa em transação: atualiza completedAt + atualiza campos desnormalizados do acessório.
     */
    async complete(
        id: string,
        accessoryId: string,
        dto: CompleteAccessoryMaintenanceDto,
        companyId: string,
    ) {
        const maintenance = await this.prisma.accessoryMaintenance.findFirst({
            where: { id, accessoryId, companyId },
            select: { id: true, completedAt: true },
        })
        if (!maintenance) throw new NotFoundException('Manutenção não encontrada')

        if (maintenance.completedAt) {
            throw new BadRequestException('Manutenção já está concluída')
        }

        const completedAt = new Date()

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.accessoryMaintenance.update({
                where: { id },
                data: {
                    completedAt,
                    observations: dto.observations,
                },
            })

            // Atualiza campos desnormalizados do acessório
            await tx.accessory.update({
                where: { id: accessoryId },
                data: {
                    lastMaintenanceAt: completedAt,
                    totalMaintenances: { increment: 1 },
                },
            })

            return updated
        })
    }
}
