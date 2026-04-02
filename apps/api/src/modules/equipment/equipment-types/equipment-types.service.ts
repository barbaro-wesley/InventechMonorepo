import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import {
    CreateEquipmentTypeDto,
    UpdateEquipmentTypeDto,
    CreateEquipmentSubtypeDto,
    UpdateEquipmentSubtypeDto,
    ListEquipmentTypesDto,
} from './dto/equipment-type.dto'

const TYPE_SELECT = {
    id: true,
    tenantId: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
    subtypes: {
        where: { isActive: true },
        select: { id: true, name: true, description: true, isActive: true },
        orderBy: { name: 'asc' as const },
    },
    _count: { select: { equipments: true } },
} satisfies Prisma.EquipmentTypeSelect

@Injectable()
export class EquipmentTypesService {
    constructor(private prisma: PrismaService) { }

    // ── Tipos ──────────────────────────────────────────

    async findAllTypes(tenantId: string, filters: ListEquipmentTypesDto) {
        const { search, isActive, page = 1, limit = 50 } = filters

        const where: Prisma.EquipmentTypeWhereInput = {
            tenantId,
            ...(isActive !== undefined && { isActive }),
            ...(search && { name: { contains: search, mode: 'insensitive' } }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.equipmentType.findMany({
                where, select: TYPE_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit, take: limit,
            }),
            this.prisma.equipmentType.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findOneType(id: string, tenantId: string) {
        const type = await this.prisma.equipmentType.findFirst({
            where: { id, tenantId },
            select: TYPE_SELECT,
        })
        if (!type) throw new NotFoundException('Tipo de equipamento não encontrado')
        return type
    }

    async createType(dto: CreateEquipmentTypeDto, tenantId: string) {
        const exists = await this.prisma.equipmentType.findFirst({
            where: { tenantId, name: { equals: dto.name, mode: 'insensitive' } },
            select: { id: true },
        })
        if (exists) throw new ConflictException('Já existe um tipo com este nome')

        return this.prisma.equipmentType.create({
            data: { tenantId, name: dto.name, description: dto.description },
            select: TYPE_SELECT,
        })
    }

    async updateType(id: string, dto: UpdateEquipmentTypeDto, tenantId: string) {
        const existing = await this.prisma.equipmentType.findFirst({
            where: { id, tenantId }, select: { id: true },
        })
        if (!existing) throw new NotFoundException('Tipo não encontrado')

        return this.prisma.equipmentType.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: TYPE_SELECT,
        })
    }

    async removeType(id: string, tenantId: string) {
        const type = await this.prisma.equipmentType.findFirst({
            where: { id, tenantId },
            select: { id: true, name: true, _count: { select: { equipments: true } } },
        })
        if (!type) throw new NotFoundException('Tipo não encontrado')
        if (type._count.equipments > 0) {
            throw new ConflictException(
                `Não é possível remover — ${type._count.equipments} equipamento(s) vinculado(s)`,
            )
        }
        await this.prisma.equipmentType.delete({ where: { id } })
        return { message: 'Tipo removido com sucesso' }
    }

    // ── Subtipos ───────────────────────────────────────

    async createSubtype(dto: CreateEquipmentSubtypeDto, tenantId: string) {
        const type = await this.prisma.equipmentType.findFirst({
            where: { id: dto.typeId, tenantId }, select: { id: true },
        })
        if (!type) throw new NotFoundException('Tipo não encontrado')

        return this.prisma.equipmentSubtype.create({
            data: { tenantId, typeId: dto.typeId, name: dto.name, description: dto.description },
            select: { id: true, typeId: true, name: true, description: true, isActive: true },
        })
    }

    async updateSubtype(id: string, dto: UpdateEquipmentSubtypeDto, tenantId: string) {
        const existing = await this.prisma.equipmentSubtype.findFirst({
            where: { id, tenantId }, select: { id: true },
        })
        if (!existing) throw new NotFoundException('Subtipo não encontrado')

        return this.prisma.equipmentSubtype.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: { id: true, typeId: true, name: true, description: true, isActive: true },
        })
    }

    async removeSubtype(id: string, tenantId: string) {
        const sub = await this.prisma.equipmentSubtype.findFirst({
            where: { id, tenantId },
            select: { id: true, _count: { select: { equipments: true } } },
        })
        if (!sub) throw new NotFoundException('Subtipo não encontrado')
        if (sub._count.equipments > 0) {
            throw new ConflictException(`${sub._count.equipments} equipamento(s) vinculado(s)`)
        }
        await this.prisma.equipmentSubtype.delete({ where: { id } })
        return { message: 'Subtipo removido com sucesso' }
    }
}