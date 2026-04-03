import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common'
import { Prisma, AttachmentEntity } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { CreateEquipmentDto, UpdateEquipmentDto, ListEquipmentsDto } from './dto/equipment.dto'
import { StorageService } from '../storage/storage.service'

const EQUIPMENT_SELECT = {
    id: true,
    companyId: true,
    name: true,
    brand: true,
    model: true,
    serialNumber: true,
    patrimonyNumber: true,
    anvisaNumber: true,
    status: true,
    criticality: true,
    purchaseValue: true,
    purchaseDate: true,
    invoiceNumber: true,
    warrantyStart: true,
    warrantyEnd: true,
    depreciationRate: true,
    currentValue: true,
    lastDepreciationCalc: true,
    ipAddress: true,
    operatingSystem: true,
    btus: true,
    voltage: true,
    power: true,
    observations: true,
    createdAt: true,
    updatedAt: true,
    type: { select: { id: true, name: true } },
    subtype: { select: { id: true, name: true } },
    location: { select: { id: true, name: true } },
    currentLocation: { select: { id: true, name: true } },
    costCenter: { select: { id: true, name: true, code: true } },
    _count: {
        select: { serviceOrders: true, maintenances: true, attachments: true },
    },
} satisfies Prisma.EquipmentSelect

type EquipmentRaw = Prisma.EquipmentGetPayload<{ select: typeof EQUIPMENT_SELECT }>

/** Converte campos Decimal do Prisma para number puro antes de retornar ao cliente */
function normalizeEquipment(eq: EquipmentRaw) {
    return {
        ...eq,
        purchaseValue: eq.purchaseValue != null ? Number(eq.purchaseValue) : null,
        currentValue: eq.currentValue != null ? Number(eq.currentValue) : null,
        depreciationRate: eq.depreciationRate != null ? Number(eq.depreciationRate) : null,
    }
}

@Injectable()
export class EquipmentService {
    constructor(
        private prisma: PrismaService,
        private storageService: StorageService,
    ) { }

    /**
     * Resolve o companyId e os typeIds permitidos com base no usuário logado.
     * - Usuários da empresa: veem todos os equipamentos da empresa.
     * - Usuários cliente: veem apenas equipamentos cujo tipo está vinculado
     *   aos grupos de manutenção atribuídos ao cliente.
     */
    private async resolveScope(currentUser: AuthenticatedUser) {
        if (!currentUser.clientId) {
            // Usuário da empresa — acesso total
            return { companyId: currentUser.companyId!, allowedTypeIds: null }
        }

        // Usuário cliente — busca a empresa do cliente e os tipos permitidos
        const client = await this.prisma.client.findUnique({
            where: { id: currentUser.clientId },
            select: {
                companyId: true,
                maintenanceGroups: {
                    where: { isActive: true },
                    select: {
                        group: {
                            select: {
                                equipmentTypes: { select: { id: true } },
                            },
                        },
                    },
                },
            },
        })

        if (!client) throw new ForbiddenException('Cliente não encontrado')

        const allowedTypeIds = client.maintenanceGroups
            .flatMap((cg) => cg.group.equipmentTypes.map((et) => et.id))

        return { companyId: client.companyId, allowedTypeIds }
    }

    async findAll(currentUser: AuthenticatedUser, filters: ListEquipmentsDto) {
        const { search, ipAddress, patrimonyNumber, status, criticality, typeId, locationId, costCenterId, page = 1, limit = 20 } = filters

        const { companyId, allowedTypeIds } = await this.resolveScope(currentUser)

        // Restrição de tipo: para clientes, intersecta o filtro do usuário com os tipos permitidos
        const effectiveTypeId = (() => {
            if (allowedTypeIds === null) {
                // Empresa — usa o filtro tal como veio (ou nenhum)
                return typeId ? { typeId } : {}
            }
            if (allowedTypeIds.length === 0) {
                // Cliente sem nenhum grupo atribuído — não vê nada
                return { typeId: '__none__' }
            }
            if (typeId) {
                // Cliente aplicou filtro de tipo: só mostra se estiver nos permitidos
                return allowedTypeIds.includes(typeId)
                    ? { typeId }
                    : { typeId: '__none__' }
            }
            return { typeId: { in: allowedTypeIds } }
        })()

        const where: Prisma.EquipmentWhereInput = {
            companyId,
            deletedAt: null,
            ...effectiveTypeId,
            ...(status && { status }),
            ...(criticality && { criticality }),
            ...(locationId && { locationId }),
            ...(costCenterId && { costCenterId }),
            ...(ipAddress && { ipAddress: { contains: ipAddress, mode: 'insensitive' } }),
            ...(patrimonyNumber && { patrimonyNumber: { contains: patrimonyNumber, mode: 'insensitive' } }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { brand: { contains: search, mode: 'insensitive' } },
                    { model: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { patrimonyNumber: { contains: search, mode: 'insensitive' } },
                    { ipAddress: { contains: search, mode: 'insensitive' } },
                ],
            }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.equipment.findMany({
                where,
                select: EQUIPMENT_SELECT,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.equipment.count({ where }),
        ])

        return { data: data.map(normalizeEquipment), total, page, limit }
    }

    async findOne(id: string, currentUser: AuthenticatedUser) {
        const { companyId, allowedTypeIds } = await this.resolveScope(currentUser)

        const equipment = await this.prisma.equipment.findFirst({
            where: { id, companyId, deletedAt: null },
            select: EQUIPMENT_SELECT,
        })

        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        // Valida se o cliente tem permissão para ver este equipamento específico
        if (allowedTypeIds !== null) {
            if (!equipment.type || !allowedTypeIds.includes(equipment.type.id)) {
                throw new NotFoundException('Equipamento não encontrado')
            }
        }

        return normalizeEquipment(equipment)
    }

    async create(
        dto: CreateEquipmentDto,
        companyId: string,
        currentUser: AuthenticatedUser,
        files: Express.Multer.File[] = [],
    ) {
        // Valida número de série único na empresa
        if (dto.serialNumber) {
            const exists = await this.prisma.equipment.findFirst({
                where: { serialNumber: dto.serialNumber, companyId, deletedAt: null },
                select: { id: true },
            })
            if (exists) {
                throw new ConflictException('Já existe um equipamento com este número de série nesta empresa')
            }
        }

        // Valida patrimônio único na empresa
        if (dto.patrimonyNumber) {
            const exists = await this.prisma.equipment.findFirst({
                where: { patrimonyNumber: dto.patrimonyNumber, companyId, deletedAt: null },
                select: { id: true },
            })
            if (exists) {
                throw new ConflictException('Já existe um equipamento com este número de patrimônio')
            }
        }

        // Calcula valor atual inicial (igual ao de compra)
        const currentValue = dto.purchaseValue ? dto.purchaseValue : null

        const equipment = await this.prisma.equipment.create({
            data: {
                companyId,
                name: dto.name,
                brand: dto.brand,
                model: dto.model,
                serialNumber: dto.serialNumber,
                patrimonyNumber: dto.patrimonyNumber,
                anvisaNumber: dto.anvisaNumber,
                purchaseValue: dto.purchaseValue ? new (require('decimal.js').Decimal)(dto.purchaseValue) : undefined,
                purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
                invoiceNumber: dto.invoiceNumber,
                warrantyStart: dto.warrantyStart ? new Date(dto.warrantyStart) : undefined,
                warrantyEnd: dto.warrantyEnd ? new Date(dto.warrantyEnd) : undefined,
                depreciationRate: dto.depreciationRate ? new (require('decimal.js').Decimal)(dto.depreciationRate) : undefined,
                currentValue: currentValue ? new (require('decimal.js').Decimal)(currentValue) : undefined,
                ipAddress: dto.ipAddress,
                operatingSystem: dto.operatingSystem,
                btus: dto.btus,
                voltage: dto.voltage,
                power: dto.power,
                criticality: dto.criticality,
                observations: dto.observations,
                typeId: dto.typeId,
                subtypeId: dto.subtypeId,
                locationId: dto.locationId,
                currentLocationId: dto.locationId,
                costCenterId: dto.costCenterId,
            },
            select: EQUIPMENT_SELECT,
        })

        // Faz upload dos arquivos se enviados junto com o cadastro
        if (files && files.length > 0) {
            await Promise.all(
                files.map((file) =>
                    this.storageService.upload(
                        file,
                        { entity: AttachmentEntity.EQUIPMENT, entityId: equipment.id },
                        companyId,
                        null,
                        currentUser,
                    ),
                ),
            )
        }

        return normalizeEquipment(equipment)
    }

    async update(
        id: string,
        dto: UpdateEquipmentDto,
        companyId: string,
    ) {
        const existing = await this.prisma.equipment.findFirst({
            where: { id, companyId, deletedAt: null },
            select: { id: true, serialNumber: true, patrimonyNumber: true },
        })
        if (!existing) throw new NotFoundException('Equipamento não encontrado')

        // Valida número de série único se mudando
        if (dto.serialNumber && dto.serialNumber !== existing.serialNumber) {
            const conflict = await this.prisma.equipment.findFirst({
                where: { serialNumber: dto.serialNumber, companyId, deletedAt: null, id: { not: id } },
                select: { id: true },
            })
            if (conflict) throw new ConflictException('Número de série já em uso nesta empresa')
        }

        const updated = await this.prisma.equipment.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.brand !== undefined && { brand: dto.brand }),
                ...(dto.model !== undefined && { model: dto.model }),
                ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
                ...(dto.patrimonyNumber !== undefined && { patrimonyNumber: dto.patrimonyNumber }),
                ...(dto.anvisaNumber !== undefined && { anvisaNumber: dto.anvisaNumber }),
                ...(dto.status && { status: dto.status }),
                ...(dto.criticality && { criticality: dto.criticality }),
                ...(dto.ipAddress !== undefined && { ipAddress: dto.ipAddress }),
                ...(dto.operatingSystem !== undefined && { operatingSystem: dto.operatingSystem }),
                ...(dto.btus !== undefined && { btus: dto.btus }),
                ...(dto.voltage !== undefined && { voltage: dto.voltage }),
                ...(dto.power !== undefined && { power: dto.power }),
                ...(dto.observations !== undefined && { observations: dto.observations }),
                ...(dto.typeId !== undefined && {
                    type: dto.typeId ? { connect: { id: dto.typeId } } : { disconnect: true },
                }),
                ...(dto.subtypeId !== undefined && {
                    subtype: dto.subtypeId ? { connect: { id: dto.subtypeId } } : { disconnect: true },
                }),
                ...(dto.locationId !== undefined && {
                    location: dto.locationId ? { connect: { id: dto.locationId } } : { disconnect: true },
                }),
                ...(dto.costCenterId !== undefined && {
                    costCenter: dto.costCenterId ? { connect: { id: dto.costCenterId } } : { disconnect: true },
                }),
            },
            select: EQUIPMENT_SELECT,
        })
        return normalizeEquipment(updated)
    }

    async remove(id: string, companyId: string) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id, companyId, deletedAt: null },
            select: {
                id: true, name: true,
                _count: { select: { serviceOrders: true } },
            },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        if (equipment._count.serviceOrders > 0) {
            throw new ConflictException(
                `Não é possível remover — ${equipment._count.serviceOrders} OS vinculada(s)`,
            )
        }

        await this.prisma.equipment.update({
            where: { id },
            data: { deletedAt: new Date() },
        })

        return { message: 'Equipamento removido com sucesso' }
    }

    // ── Cálculo de depreciação ─────────────────────────
    // Depreciação linear: valor_atual = valor_compra * (1 - taxa * anos)
    async recalculateDepreciation(id: string, companyId: string) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id, companyId, deletedAt: null },
            select: {
                id: true,
                purchaseValue: true,
                purchaseDate: true,
                depreciationRate: true,
            },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        if (
            !equipment.purchaseValue ||
            !equipment.purchaseDate ||
            !equipment.depreciationRate
        ) {
            return { message: 'Dados insuficientes para calcular depreciação' }
        }

        const yearsElapsed =
            (Date.now() - new Date(equipment.purchaseDate).getTime()) /
            (1000 * 60 * 60 * 24 * 365)

        const rate = Number(equipment.depreciationRate) / 100
        const purchaseValue = Number(equipment.purchaseValue)
        const currentValue = Math.max(0, purchaseValue * (1 - rate * yearsElapsed))

        await this.prisma.equipment.update({
            where: { id },
            data: {
                currentValue: currentValue,
                lastDepreciationCalc: new Date(),
            },
        })

        return {
            purchaseValue,
            currentValue: Number(currentValue.toFixed(2)),
            yearsElapsed: Number(yearsElapsed.toFixed(2)),
            depreciationRate: Number(equipment.depreciationRate),
        }
    }
}
