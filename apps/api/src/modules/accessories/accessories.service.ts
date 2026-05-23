import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common'
import { Prisma, AccessoryStatus, AccessoryOwnership, EquipmentCriticality } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { CreateAccessoryDto, UpdateAccessoryDto, ListAccessoriesDto } from './dto/accessory.dto'

// ─── Select seguro — nunca expõe dados de outros tenants ────────────────────
const ACCESSORY_SELECT = {
    id: true,
    name: true,
    brand: true,
    model: true,
    serialNumber: true,
    patrimonyNumber: true,
    qrCode: true,
    anvisaNumber: true,
    ownership: true,
    purchaseValue: true,
    purchaseDate: true,
    invoiceNumber: true,
    warrantyStart: true,
    warrantyEnd: true,
    status: true,
    criticality: true,
    observations: true,
    currentLocationId: true,
    currentEquipmentId: true,
    lastMaintenanceAt: true,
    totalMaintenances: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { id: true, name: true, color: true } },
    currentLocation: { select: { id: true, name: true } },
    currentEquipment: { select: { id: true, name: true, serialNumber: true } },
    _count: {
        select: { assignments: true, movements: true, maintenances: true, attachments: true },
    },
} satisfies Prisma.AccessorySelect

type AccessoryRaw = Prisma.AccessoryGetPayload<{ select: typeof ACCESSORY_SELECT }>

function normalizeAccessory(a: AccessoryRaw) {
    return {
        ...a,
        purchaseValue: a.purchaseValue != null ? Number(a.purchaseValue) : null,
    }
}

/** Gera QR code único: ACC-<6 chars companyId>-<UUID truncado> */
function generateQrCode(companyId: string): string {
    return `ACC-${companyId.slice(0, 6).toUpperCase()}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

@Injectable()
export class AccessoriesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Resolve o companyId e os equipmentIds visíveis ao usuário.
     * - Empresa: vê todos os acessórios da empresa.
     * - Cliente: vê apenas acessórios vinculados a equipamentos do escopo do cliente.
     */
    private async resolveAccessoryScope(currentUser: AuthenticatedUser) {
        if (!currentUser.clientId) {
            return { companyId: currentUser.companyId!, equipmentIdFilter: null as string[] | null }
        }

        const client = await this.prisma.client.findUnique({
            where: { id: currentUser.clientId },
            select: {
                companyId: true,
                maintenanceGroups: {
                    where: { isActive: true },
                    select: {
                        group: {
                            select: {
                                noRestriction: true,
                                equipmentTypes: { select: { id: true } },
                            },
                        },
                    },
                },
            },
        })
        if (!client) throw new ForbiddenException('Cliente não encontrado')

        const hasUnrestrictedGroup = client.maintenanceGroups.some((cg) => cg.group.noRestriction)
        if (hasUnrestrictedGroup) {
            // Busca todos os equipment IDs do cliente (sem restrição de tipo)
            const equipments = await this.prisma.equipment.findMany({
                where: { companyId: client.companyId, deletedAt: null },
                select: { id: true },
            })
            return {
                companyId: client.companyId,
                equipmentIdFilter: equipments.map((e) => e.id),
            }
        }

        const allowedTypeIds = client.maintenanceGroups.flatMap((cg) =>
            cg.group.equipmentTypes.map((et) => et.id),
        )

        if (allowedTypeIds.length === 0) {
            return { companyId: client.companyId, equipmentIdFilter: [] as string[] }
        }

        const equipments = await this.prisma.equipment.findMany({
            where: {
                companyId: client.companyId,
                deletedAt: null,
                typeId: { in: allowedTypeIds },
            },
            select: { id: true },
        })

        return {
            companyId: client.companyId,
            equipmentIdFilter: equipments.map((e) => e.id),
        }
    }

    async findAll(currentUser: AuthenticatedUser, filters: ListAccessoriesDto) {
        const {
            search, status, criticality, categoryId, currentEquipmentId,
            currentLocationId, qrCode, warrantyFilter,
            page = 1, limit = 20,
        } = filters

        const { companyId, equipmentIdFilter } = await this.resolveAccessoryScope(currentUser)

        // Clientes não veem acessórios disponíveis (sem equipamento vinculado)
        const isClientUser = !!currentUser.clientId

        const warrantyCondition = (() => {
            if (!warrantyFilter) return {}
            const now = new Date()
            if (warrantyFilter === 'expired') {
                return { warrantyEnd: { lt: now } }
            }
            // expiring: vence nos próximos 30 dias
            const in30days = new Date()
            in30days.setDate(in30days.getDate() + 30)
            return { warrantyEnd: { gte: now, lte: in30days } }
        })()

        const where: Prisma.AccessoryWhereInput = {
            companyId,
            deletedAt: null,
            ...(status && { status }),
            ...(criticality && { criticality }),
            ...(categoryId && { categoryId }),
            ...(qrCode && { qrCode }),
            ...(currentLocationId && { currentLocationId }),
            // Escopo de cliente: apenas acessórios dos equipamentos visíveis
            ...(equipmentIdFilter !== null && {
                currentEquipmentId: equipmentIdFilter.length > 0
                    ? { in: equipmentIdFilter }
                    : '__no_results__',  // força 0 resultados se cliente sem grupos
            }),
            // Clientes não veem AVAILABLE
            ...(isClientUser && { status: AccessoryStatus.IN_USE }),
            ...(currentEquipmentId && { currentEquipmentId }),
            ...warrantyCondition,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { brand: { contains: search, mode: 'insensitive' } },
                    { model: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { patrimonyNumber: { contains: search, mode: 'insensitive' } },
                ],
            }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.accessory.findMany({
                where,
                select: ACCESSORY_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.accessory.count({ where }),
        ])

        return { data: data.map(normalizeAccessory), total, page, limit }
    }

    async findOne(id: string, currentUser: AuthenticatedUser) {
        const { companyId, equipmentIdFilter } = await this.resolveAccessoryScope(currentUser)

        const accessory = await this.prisma.accessory.findFirst({
            where: { id, companyId, deletedAt: null },
            select: ACCESSORY_SELECT,
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        // Verifica escopo do cliente
        if (equipmentIdFilter !== null) {
            if (!accessory.currentEquipmentId || !equipmentIdFilter.includes(accessory.currentEquipmentId)) {
                throw new NotFoundException('Acessório não encontrado')
            }
        }

        return normalizeAccessory(accessory)
    }

    async findHistory(id: string, companyId: string) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        const [statusHistory, assignments, movements, maintenances] = await Promise.all([
            this.prisma.accessoryStatusHistory.findMany({
                where: { accessoryId: id },
                orderBy: { createdAt: 'desc' },
                include: { changedBy: { select: { id: true, name: true } } },
            }),
            this.prisma.accessoryAssignment.findMany({
                where: { accessoryId: id },
                orderBy: { assignedAt: 'desc' },
                include: {
                    equipment: { select: { id: true, name: true } },
                    assignedBy: { select: { id: true, name: true } },
                    unassignedBy: { select: { id: true, name: true } },
                },
            }),
            this.prisma.accessoryMovement.findMany({
                where: { accessoryId: id },
                orderBy: { createdAt: 'desc' },
                include: {
                    origin: { select: { id: true, name: true } },
                    destination: { select: { id: true, name: true } },
                    requester: { select: { id: true, name: true } },
                },
            }),
            this.prisma.accessoryMaintenance.findMany({
                where: { accessoryId: id },
                orderBy: { createdAt: 'desc' },
                include: { technician: { select: { id: true, name: true } } },
            }),
        ])

        return { statusHistory, assignments, movements, maintenances }
    }

    async create(dto: CreateAccessoryDto, companyId: string, currentUser: AuthenticatedUser) {
        // Valida categoria (se informada)
        if (dto.categoryId) {
            const cat = await this.prisma.accessoryCategory.findFirst({
                where: { id: dto.categoryId, companyId },
                select: { id: true },
            })
            if (!cat) throw new BadRequestException('Categoria não encontrada')
        }

        // Valida localização inicial (se informada)
        if (dto.currentLocationId) {
            const loc = await this.prisma.location.findFirst({
                where: { id: dto.currentLocationId, companyId },
                select: { id: true },
            })
            if (!loc) throw new BadRequestException('Localização não encontrada nesta empresa')
        }

        // Gera QR Code único se não fornecido
        let qrCode = dto.qrCode
        if (!qrCode) {
            // Garante unicidade — tenta até 3 vezes
            for (let attempt = 0; attempt < 3; attempt++) {
                const candidate = generateQrCode(companyId)
                const existing = await this.prisma.accessory.findUnique({
                    where: { qrCode: candidate },
                    select: { id: true },
                })
                if (!existing) {
                    qrCode = candidate
                    break
                }
            }
            if (!qrCode) throw new ConflictException('Não foi possível gerar QR Code único')
        } else {
            // Valida unicidade do QR code fornecido
            const existing = await this.prisma.accessory.findUnique({
                where: { qrCode },
                select: { id: true },
            })
            if (existing) throw new ConflictException(`QR Code '${qrCode}' já está em uso`)
        }

        try {
            const created = await this.prisma.accessory.create({
                data: {
                    companyId,
                    categoryId: dto.categoryId,
                    name: dto.name,
                    brand: dto.brand,
                    model: dto.model,
                    serialNumber: dto.serialNumber,
                    patrimonyNumber: dto.patrimonyNumber,
                    qrCode,
                    anvisaNumber: dto.anvisaNumber,
                    ownership: dto.ownership ?? AccessoryOwnership.COMPANY,
                    purchaseValue: dto.purchaseValue,
                    purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
                    invoiceNumber: dto.invoiceNumber,
                    warrantyStart: dto.warrantyStart ? new Date(dto.warrantyStart) : null,
                    warrantyEnd: dto.warrantyEnd ? new Date(dto.warrantyEnd) : null,
                    criticality: dto.criticality ?? EquipmentCriticality.MEDIUM,
                    observations: dto.observations,
                    currentLocationId: dto.currentLocationId,
                    status: AccessoryStatus.AVAILABLE,
                },
                select: ACCESSORY_SELECT,
            })

            // Registra histórico inicial
            await this.prisma.accessoryStatusHistory.create({
                data: {
                    accessoryId: created.id,
                    fromStatus: null,
                    toStatus: AccessoryStatus.AVAILABLE,
                    changedById: currentUser.sub,
                    reason: 'Acessório cadastrado',
                },
            })

            return normalizeAccessory(created)
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException('Número de série ou patrimônio já cadastrado nesta empresa')
            }
            throw err
        }
    }

    async update(id: string, dto: UpdateAccessoryDto, companyId: string) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        if (dto.categoryId) {
            const cat = await this.prisma.accessoryCategory.findFirst({
                where: { id: dto.categoryId, companyId },
                select: { id: true },
            })
            if (!cat) throw new BadRequestException('Categoria não encontrada')
        }

        if (dto.currentLocationId) {
            const loc = await this.prisma.location.findFirst({
                where: { id: dto.currentLocationId, companyId },
                select: { id: true },
            })
            if (!loc) throw new BadRequestException('Localização não encontrada nesta empresa')
        }

        if (dto.qrCode) {
            const existing = await this.prisma.accessory.findFirst({
                where: { qrCode: dto.qrCode, id: { not: id } },
                select: { id: true },
            })
            if (existing) throw new ConflictException(`QR Code '${dto.qrCode}' já está em uso`)
        }

        try {
            const updated = await this.prisma.accessory.update({
                where: { id },
                data: {
                    ...dto,
                    purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
                    warrantyStart: dto.warrantyStart ? new Date(dto.warrantyStart) : undefined,
                    warrantyEnd: dto.warrantyEnd ? new Date(dto.warrantyEnd) : undefined,
                },
                select: ACCESSORY_SELECT,
            })
            return normalizeAccessory(updated)
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException('Número de série ou patrimônio já cadastrado nesta empresa')
            }
            throw err
        }
    }

    async remove(id: string, companyId: string) {
        const accessory = await this.prisma.accessory.findFirst({
            where: { id, companyId, deletedAt: null },
            select: { id: true, status: true },
        })
        if (!accessory) throw new NotFoundException('Acessório não encontrado')

        if (accessory.status === AccessoryStatus.IN_USE) {
            throw new ConflictException('Acessório vinculado não pode ser removido. Desvincule primeiro.')
        }

        // Soft delete
        await this.prisma.accessory.update({
            where: { id },
            data: { deletedAt: new Date() },
        })

        return { message: 'Acessório removido com sucesso' }
    }

    /** Busca acessórios de um equipamento específico (para tab na tela de equipamento) */
    async findByEquipment(equipmentId: string, companyId: string) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: equipmentId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        const data = await this.prisma.accessory.findMany({
            where: { currentEquipmentId: equipmentId, companyId, deletedAt: null },
            select: ACCESSORY_SELECT,
            orderBy: { name: 'asc' },
        })

        return data.map(normalizeAccessory)
    }
}
