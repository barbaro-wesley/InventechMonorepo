import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import {
    CreateCostCenterDto,
    UpdateCostCenterDto,
    ListCostCentersDto,
} from './dto/cost-center.dto'

const COST_CENTER_SELECT = {
    id: true,
    companyId: true,
    name: true,
    code: true,
    description: true,
    isActive: true,
    createdAt: true,
    _count: { select: { equipments: true, locations: true } },
    locations: {
        select: {
            id: true,
            name: true,
            parentId: true,
            description: true,
            isActive: true,
            costCenterId: true,
            _count: { select: { equipments: true } },
            parent: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' as const },
    },
} satisfies Prisma.CostCenterSelect

@Injectable()
export class CostCentersService {
    constructor(private prisma: PrismaService) { }

    async findAll(companyId: string, filters: ListCostCentersDto) {
        const { search, isActive, page = 1, limit = 50 } = filters

        const where: Prisma.CostCenterWhereInput = {
            companyId,
            ...(isActive !== undefined && { isActive }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                ],
            }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.costCenter.findMany({
                where,
                select: COST_CENTER_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.costCenter.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findOne(id: string, companyId: string) {
        const cc = await this.prisma.costCenter.findFirst({
            where: { id, companyId },
            select: COST_CENTER_SELECT,
        })
        if (!cc) throw new NotFoundException('Centro de custo não encontrado')
        return cc
    }

    async create(dto: CreateCostCenterDto, companyId: string) {
        if (dto.code) {
            const exists = await this.prisma.costCenter.findUnique({
                where: { companyId_code: { companyId, code: dto.code } },
                select: { id: true },
            })
            if (exists) {
                throw new ConflictException(
                    'Já existe um centro de custo com este código nesta empresa',
                )
            }
        }

        return this.prisma.costCenter.create({
            data: { companyId, name: dto.name, code: dto.code, description: dto.description },
            select: COST_CENTER_SELECT,
        })
    }

    async update(id: string, dto: UpdateCostCenterDto, companyId: string) {
        const existing = await this.prisma.costCenter.findFirst({
            where: { id, companyId },
            select: { id: true, code: true },
        })
        if (!existing) throw new NotFoundException('Centro de custo não encontrado')

        if (dto.code && dto.code !== existing.code) {
            const exists = await this.prisma.costCenter.findUnique({
                where: { companyId_code: { companyId, code: dto.code } },
                select: { id: true },
            })
            if (exists) throw new ConflictException('Código já em uso nesta empresa')
        }

        return this.prisma.costCenter.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: COST_CENTER_SELECT,
        })
    }

    async remove(id: string, companyId: string) {
        const cc = await this.prisma.costCenter.findFirst({
            where: { id, companyId },
            select: { id: true, locations: { select: { id: true } } },
        })
        if (!cc) throw new NotFoundException('Centro de custo não encontrado')

        const locationIds = cc.locations.map((l) => l.id)

        try {
            await this.prisma.$transaction(async (tx) => {
                // Desvincula os equipamentos do centro de custo
                await tx.equipment.updateMany({
                    where: { costCenterId: id },
                    data: { costCenterId: null },
                })

                if (locationIds.length > 0) {
                    // Desvincula os equipamentos das localizações (atual e de lotação)
                    await tx.equipment.updateMany({
                        where: { locationId: { in: locationIds } },
                        data: { locationId: null },
                    })
                    await tx.equipment.updateMany({
                        where: { currentLocationId: { in: locationIds } },
                        data: { currentLocationId: null },
                    })

                    // Remove as localizações (parent_id é ON DELETE SET NULL,
                    // então sublocalizações não bloqueiam a exclusão em lote)
                    await tx.location.deleteMany({
                        where: { id: { in: locationIds }, companyId },
                    })
                }

                await tx.costCenter.delete({ where: { id } })
            })
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2003'
            ) {
                throw new ConflictException(
                    'Não é possível remover — existem registros de movimentação vinculados às localizações deste centro de custo',
                )
            }
            throw e
        }

        return { message: 'Centro de custo e localizações removidos com sucesso' }
    }
}
