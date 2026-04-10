import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common'
import {
    Prisma,
    ServiceOrderStatus,
    ServiceOrderTechnicianRole,
    UserRole,
    EquipmentStatus,
    MaintenanceType,
} from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import {
    CreateServiceOrderDto,
    UpdateServiceOrderDto,
    UpdateServiceOrderStatusDto,
    AssignTechnicianDto,
    ListServiceOrdersDto,
    ListAvailableServiceOrdersDto,
} from './dto/service-order.dto'
import { NotificationsService } from '../notifications/notifications.service'
import { NOTIFICATION_EVENTS } from '../notifications/notifications.constants'

const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
    [ServiceOrderStatus.OPEN]: [
        ServiceOrderStatus.AWAITING_PICKUP,
        ServiceOrderStatus.IN_PROGRESS,
        ServiceOrderStatus.CANCELLED,
    ],
    [ServiceOrderStatus.AWAITING_PICKUP]: [
        ServiceOrderStatus.IN_PROGRESS,
        ServiceOrderStatus.CANCELLED,
    ],
    [ServiceOrderStatus.IN_PROGRESS]: [
        ServiceOrderStatus.COMPLETED,
        ServiceOrderStatus.CANCELLED,
    ],
    [ServiceOrderStatus.COMPLETED]: [
        ServiceOrderStatus.COMPLETED_APPROVED,
        ServiceOrderStatus.COMPLETED_REJECTED,
    ],
    [ServiceOrderStatus.COMPLETED_APPROVED]: [],
    [ServiceOrderStatus.COMPLETED_REJECTED]: [ServiceOrderStatus.OPEN],
    [ServiceOrderStatus.CANCELLED]: [],
}

const APPROVER_ROLES: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.COMPANY_MANAGER,
    UserRole.CLIENT_ADMIN,
]

const OS_SELECT = {
    id: true,
    companyId: true,
    clientId: true,
    number: true,
    title: true,
    description: true,
    maintenanceType: true,
    status: true,
    priority: true,
    resolution: true,
    internalNotes: true,
    estimatedHours: true,
    actualHours: true,
    scheduledFor: true,
    startedAt: true,
    completedAt: true,
    approvedAt: true,
    isAvailable: true,
    alertAfterHours: true,
    alertSentAt: true,
    createdAt: true,
    updatedAt: true,
    equipment: { select: { id: true, name: true, brand: true, model: true } },
    client: { select: { id: true, name: true, logoUrl: true } },
    requester: { select: { id: true, name: true, email: true } },
    group: { select: { id: true, name: true, color: true } },
    technicians: {
        where: { releasedAt: null },
        select: {
            id: true,
            role: true,
            assignedAt: true,
            assumedAt: true,
            technician: { select: { id: true, name: true, email: true, phone: true } },
        },
    },
    _count: {
        select: { comments: true, tasks: true, attachments: true },
    },
} satisfies Prisma.ServiceOrderSelect

@Injectable()
export class ServiceOrdersService {
    private readonly logger = new Logger(ServiceOrdersService.name)

    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) { }

    async findAll(
        clientId: string,
        companyId: string,
        filters: ListServiceOrdersDto,
        currentUser: AuthenticatedUser,
    ) {
        const {
            search, status, priority, equipmentId,
            groupId, dateFrom, dateTo, page = 1, limit = 20,
        } = filters

        const where: Prisma.ServiceOrderWhereInput = {
            clientId,
            companyId,
            deletedAt: null,
            ...(status && { status }),
            ...(priority && { priority }),
            ...(equipmentId && { equipmentId }),
            ...(groupId && { groupId }),
            ...((dateFrom || dateTo) && {
                createdAt: {
                    ...(dateFrom && { gte: new Date(dateFrom) }),
                    ...(dateTo && { lte: new Date(dateTo) }),
                },
            }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }),
        }

        if (currentUser.role === UserRole.TECHNICIAN && !currentUser.clientId) {
            where.technicians = {
                some: { technicianId: currentUser.sub, releasedAt: null },
            }
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.serviceOrder.findMany({
                where,
                select: OS_SELECT,
                orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.serviceOrder.count({ where }),
        ])

        return { data, total, page, limit }
    }

    // ─────────────────────────────────────────
    // Painel pessoal — apenas OS do solicitante
    // ─────────────────────────────────────────
    async findMine(
        companyId: string,
        filters: ListServiceOrdersDto,
        currentUser: AuthenticatedUser,
    ) {
        const {
            search, status, priority, equipmentId,
            groupId, dateFrom, dateTo, page = 1, limit = 20,
        } = filters

        const where: Prisma.ServiceOrderWhereInput = {
            companyId,
            requesterId: currentUser.sub,
            deletedAt: null,
            ...(status && { status }),
            ...(priority && { priority }),
            ...(equipmentId && { equipmentId }),
            ...(groupId && { groupId }),
            ...((dateFrom || dateTo) && {
                createdAt: {
                    ...(dateFrom && { gte: new Date(dateFrom) }),
                    ...(dateTo && { lte: new Date(dateTo) }),
                },
            }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.serviceOrder.findMany({
                where,
                select: OS_SELECT,
                orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.serviceOrder.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findMyStats(companyId: string, requesterId: string) {
        const groups = await this.prisma.serviceOrder.groupBy({
            by: ['status'],
            where: { companyId, requesterId, deletedAt: null },
            _count: { _all: true },
        })

        const result = Object.fromEntries(
            Object.values(ServiceOrderStatus).map((s) => [s, 0]),
        ) as Record<ServiceOrderStatus, number>

        for (const g of groups) {
            result[g.status] = g._count._all
        }

        return result
    }

    // Visão company-wide — painel operacional (sem clientId)
    async findAllForCompany(
        companyId: string,
        filters: ListServiceOrdersDto,
        currentUser: AuthenticatedUser,
    ) {
        const {
            search, status, priority, equipmentId,
            groupId, dateFrom, dateTo, page = 1, limit = 50,
        } = filters

        const where: Prisma.ServiceOrderWhereInput = {
            companyId,
            deletedAt: null,
            ...(status && { status }),
            ...(priority && { priority }),
            ...(equipmentId && { equipmentId }),
            ...(groupId && { groupId }),
            ...((dateFrom || dateTo) && {
                createdAt: {
                    ...(dateFrom && { gte: new Date(dateFrom) }),
                    ...(dateTo && { lte: new Date(dateTo) }),
                },
            }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { client: { name: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        }

        if (currentUser.role === UserRole.TECHNICIAN) {
            if (currentUser.clientId) {
                // Técnico vinculado a um cliente vê todas as OS do seu cliente
                where.clientId = currentUser.clientId
            } else {
                // Técnico de empresa sem cliente fixo vê apenas as OS que assumiu
                where.technicians = {
                    some: { technicianId: currentUser.sub, releasedAt: null },
                }
            }
        }

        if (currentUser.role === UserRole.CLIENT_ADMIN || currentUser.role === UserRole.CLIENT_USER) {
            where.clientId = currentUser.clientId!
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.serviceOrder.findMany({
                where,
                select: OS_SELECT,
                orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.serviceOrder.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findAvailable(
        companyId: string,
        filters: ListAvailableServiceOrdersDto,
        currentUser: AuthenticatedUser,
    ) {
        const { groupId, page = 1, limit = 20 } = filters

        let groupIds: string[] = []

        if (groupId) {
            groupIds = [groupId]
        } else if (currentUser.role === UserRole.TECHNICIAN) {
            const techGroups = await this.prisma.technicianGroup.findMany({
                where: { userId: currentUser.sub, isActive: true },
                select: { groupId: true },
            })
            groupIds = techGroups.map((g) => g.groupId)
        }

        const where: Prisma.ServiceOrderWhereInput = {
            companyId,
            isAvailable: true,
            status: ServiceOrderStatus.AWAITING_PICKUP,
            deletedAt: null,
            ...(groupIds.length > 0 && { groupId: { in: groupIds } }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.serviceOrder.findMany({
                where,
                select: OS_SELECT,
                orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.serviceOrder.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findOne(
        id: string,
        clientId: string | null,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const os = await this.prisma.serviceOrder.findFirst({
            where: {
                id,
                companyId,
                deletedAt: null,
                ...(clientId && { OR: [{ clientId }, { clientId: null }] }),
            },
            select: {
                ...OS_SELECT,
                comments: {
                    where: this.buildCommentFilter(currentUser),
                    select: {
                        id: true,
                        content: true,
                        isInternal: true,
                        createdAt: true,
                        updatedAt: true,
                        author: { select: { id: true, name: true, role: true } },
                        attachments: {
                            select: {
                                id: true,
                                fileName: true,
                                mimeType: true,
                                sizeBytes: true,
                                createdAt: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                tasks: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        status: true,
                        position: true,
                        dueDate: true,
                        completedAt: true,
                        assignedTo: { select: { id: true, name: true } },
                    },
                    orderBy: { position: 'asc' },
                },
                statusHistory: {
                    select: {
                        id: true,
                        fromStatus: true,
                        toStatus: true,
                        reason: true,
                        createdAt: true,
                        changedBy: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                attachments: {
                    where: { entity: 'SERVICE_ORDER' },
                    select: {
                        id: true,
                        fileName: true,
                        mimeType: true,
                        sizeBytes: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        })

        if (!os) throw new NotFoundException('Ordem de serviço não encontrada')

        if (currentUser.role === UserRole.TECHNICIAN) {
            // Técnico vinculado a um prestador pode ver qualquer OS do seu prestador
            // (a query já está filtrada por clientId)
            if (!currentUser.clientId) {
                // Técnico interno: só vê OS em que está vinculado ou que estão disponíveis
                const isLinked = os.technicians.some((t) => t.technician.id === currentUser.sub)
                if (!isLinked && !os.isAvailable) {
                    throw new ForbiddenException('Acesso negado a esta OS')
                }
            }
        }

        return os
    }

    // ─────────────────────────────────────────
    // Criar OS + disparar notificação
    // ─────────────────────────────────────────
    async create(
        dto: CreateServiceOrderDto,
        clientId: string,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: dto.equipmentId, companyId, deletedAt: null },
            select: {
                id: true,
                name: true,
                type: { select: { id: true, name: true, groupId: true } },
            },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado neste cliente')

        let groupName: string | undefined
        if (dto.groupId) {
            const group = await this.prisma.maintenanceGroup.findFirst({
                where: { id: dto.groupId, companyId, isActive: true },
                select: { id: true, name: true },
            })
            if (!group) throw new BadRequestException('Grupo de manutenção não encontrado')
            groupName = group.name

            // Valida que o tipo do equipamento tem um grupo configurado
            const equipmentGroupId = equipment.type?.groupId
            if (!equipmentGroupId) {
                throw new BadRequestException(
                    `O tipo "${equipment.type?.name}" do equipamento não possui grupo vinculado. ` +
                    'Configure o grupo no cadastro do tipo antes de abrir uma OS.',
                )
            }

            // Valida que o grupo informado é o grupo do tipo do equipamento
            if (equipmentGroupId !== dto.groupId) {
                throw new BadRequestException(
                    `Este equipamento pertence ao grupo "${equipment.type?.name}". ` +
                    'Informe o grupo correto ou altere o tipo do equipamento.',
                )
            }
        }

        if (dto.technicianId) {
            const assumeRoles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.TECHNICIAN]
            const technician = await this.prisma.user.findFirst({
                where: {
                    id: dto.technicianId,
                    companyId,
                    deletedAt: null,
                    OR: [
                        { customRoleId: null, role: { in: assumeRoles } },
                        {
                            customRoleId: { not: null },
                            customRole: { permissions: { some: { resource: 'service-order', action: 'assume' } } },
                        },
                    ],
                },
                select: { id: true },
            })
            if (!technician) throw new BadRequestException('Técnico não encontrado nesta empresa')
        }

        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
            select: { name: true },
        })

        const isAvailable = !dto.technicianId
        const initialStatus = isAvailable
            ? ServiceOrderStatus.AWAITING_PICKUP
            : ServiceOrderStatus.OPEN

        const os = await this.prisma.$transaction(async (tx) => {
            const last = await tx.serviceOrder.findFirst({
                where: { companyId },
                orderBy: { number: 'desc' },
                select: { number: true },
            })
            const number = (last?.number ?? 0) + 1

            const created = await tx.serviceOrder.create({
                data: {
                    companyId,
                    clientId,
                    number,
                    title: dto.title,
                    description: dto.description,
                    maintenanceType: dto.maintenanceType,
                    priority: dto.priority,
                    status: initialStatus,
                    isAvailable,
                    alertAfterHours: dto.alertAfterHours ?? 2,
                    scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
                    equipmentId: dto.equipmentId,
                    requesterId: currentUser.sub,
                    ...(dto.groupId && { groupId: dto.groupId }),
                },
                select: OS_SELECT,
            })

            if (dto.technicianId) {
                await tx.serviceOrderTechnician.create({
                    data: {
                        serviceOrderId: created.id,
                        technicianId: dto.technicianId,
                        role: ServiceOrderTechnicianRole.LEAD,
                    },
                })
            }

            await tx.serviceOrderStatusHistory.create({
                data: {
                    serviceOrderId: created.id,
                    toStatus: initialStatus,
                    changedById: currentUser.sub,
                },
            })

            // Incrementa contador de OS e marca equipamento como em manutenção
            await tx.equipment.update({
                where: { id: dto.equipmentId },
                data: { totalServiceOrders: { increment: 1 } },
            })
            await tx.equipment.updateMany({
                where: { id: dto.equipmentId, status: EquipmentStatus.ACTIVE },
                data: { status: EquipmentStatus.UNDER_MAINTENANCE },
            })

            return created
        })

        // ── Notificações ──────────────────────────────────────────
        if (dto.technicianId) {
            // Técnico designado na criação
            await this.notificationsService.notify({
                event: NOTIFICATION_EVENTS.OS_TECHNICIAN_ASSIGNED,
                companyId,
                serviceOrderId: os.id,
                data: {
                    technicianId: dto.technicianId,
                    osNumber: os.number,
                    osTitle: os.title,
                    clientName: client?.name ?? '',
                    equipmentName: equipment.name,
                    priority: os.priority,
                },
            })
        } else {
            // OS sem técnico → vai para o painel
            await this.notificationsService.notify({
                event: NOTIFICATION_EVENTS.OS_CREATED_NO_TECHNICIAN,
                companyId,
                serviceOrderId: os.id,
                data: {
                    osNumber: os.number,
                    osTitle: os.title,
                    groupId: dto.groupId ?? null,
                    clientName: client?.name ?? '',
                    equipmentName: equipment.name,
                    priority: os.priority,
                },
            })
        }

        this.logger.log(`OS #${os.number} criada | ${isAvailable ? 'Painel' : 'Técnico: ' + dto.technicianId}`)
        return os
    }

    // ─────────────────────────────────────────
    // Técnico assume OS + notifica
    // ─────────────────────────────────────────
    async assumeServiceOrder(
        id: string,
        clientId: string | null,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const os = await this.prisma.serviceOrder.findFirst({
            where: {
                id,
                companyId,
                deletedAt: null,
                OR: [{ clientId }, { clientId: null }],
            },
            select: {
                id: true, number: true, status: true,
                isAvailable: true, groupId: true,
                title: true, requesterId: true,
            },
        })

        if (!os) throw new NotFoundException('OS não encontrada')
        if (!os.isAvailable || os.status !== ServiceOrderStatus.AWAITING_PICKUP) {
            throw new ConflictException('Esta OS não está disponível para ser assumida')
        }

        // Admins/gestores têm acesso amplo — não precisam de vínculo com o grupo
        const hasGlobalAccess = (
            [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER] as UserRole[]
        ).includes(currentUser.role)

        if (os.groupId && !hasGlobalAccess) {
            let authorized = false

            if (currentUser.clientId) {
                // Usuário vinculado a um prestador: verifica se o prestador atende esse grupo
                const clientGroup = await this.prisma.clientMaintenanceGroup.findFirst({
                    where: { clientId: currentUser.clientId, groupId: os.groupId, isActive: true },
                    select: { id: true },
                })
                authorized = !!clientGroup
            } else {
                // Usuário interno: verifica vínculo direto com o grupo
                const techGroup = await this.prisma.technicianGroup.findFirst({
                    where: { userId: currentUser.sub, groupId: os.groupId, isActive: true },
                    select: { id: true },
                })
                authorized = !!techGroup
            }

            if (!authorized) {
                throw new ForbiddenException('Você não pertence ao grupo responsável por esta OS')
            }
        }

        const alreadyLinked = await this.prisma.serviceOrderTechnician.findUnique({
            where: {
                serviceOrderId_technicianId: { serviceOrderId: id, technicianId: currentUser.sub },
            },
            select: { id: true },
        })
        if (alreadyLinked) throw new ConflictException('Você já está vinculado a esta OS')

        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.serviceOrderTechnician.create({
                data: {
                    serviceOrderId: id,
                    technicianId: currentUser.sub,
                    role: ServiceOrderTechnicianRole.LEAD,
                    assumedAt: new Date(),
                },
            })

            const result = await tx.serviceOrder.update({
                where: { id },
                data: {
                    isAvailable: false,
                    status: ServiceOrderStatus.IN_PROGRESS,
                    startedAt: new Date(),
                },
                select: OS_SELECT,
            })

            await tx.serviceOrderStatusHistory.create({
                data: {
                    serviceOrderId: id,
                    fromStatus: ServiceOrderStatus.AWAITING_PICKUP,
                    toStatus: ServiceOrderStatus.IN_PROGRESS,
                    changedById: currentUser.sub,
                    reason: 'Técnico assumiu a OS do painel',
                },
            })

            return result
        })

        // ── Notificação ───────────────────────────────────────────
        await this.notificationsService.notify({
            event: NOTIFICATION_EVENTS.OS_TECHNICIAN_ASSUMED,
            companyId,
            serviceOrderId: id,
            data: {
                technicianName: currentUser.email, // será enriquecido no service de notificações
                requesterId: os.requesterId,
                osNumber: os.number,
                osTitle: os.title,
            },
        })

        this.logger.log(`OS #${os.number} assumida por: ${currentUser.email}`)
        return updated
    }

    async addTechnician(
        id: string,
        dto: AssignTechnicianDto,
        clientId: string | null,
        companyId: string,
    ) {
        const os = await this.findExisting(id, clientId, companyId)

        if (os.status === ServiceOrderStatus.COMPLETED_APPROVED || os.status === ServiceOrderStatus.CANCELLED) {
            throw new ConflictException('Não é possível adicionar técnico neste status')
        }

        const assumeRoles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.TECHNICIAN]
        const technician = await this.prisma.user.findFirst({
            where: {
                id: dto.technicianId,
                companyId,
                deletedAt: null,
                OR: [
                    { customRoleId: null, role: { in: assumeRoles } },
                    {
                        customRoleId: { not: null },
                        customRole: { permissions: { some: { resource: 'service-order', action: 'assume' } } },
                    },
                ],
            },
            select: { id: true, name: true },
        })
        if (!technician) throw new NotFoundException('Técnico não encontrado')

        const alreadyLinked = await this.prisma.serviceOrderTechnician.findUnique({
            where: {
                serviceOrderId_technicianId: { serviceOrderId: id, technicianId: dto.technicianId },
            },
            select: { id: true, releasedAt: true },
        })

        if (alreadyLinked && !alreadyLinked.releasedAt) {
            throw new ConflictException(`${technician.name} já está vinculado a esta OS`)
        }

        const role = dto.role ?? ServiceOrderTechnicianRole.ASSISTANT

        const result = alreadyLinked
            ? await this.prisma.serviceOrderTechnician.update({
                where: {
                    serviceOrderId_technicianId: { serviceOrderId: id, technicianId: dto.technicianId },
                },
                data: { releasedAt: null, role, assignedAt: new Date() },
            })
            : await this.prisma.serviceOrderTechnician.create({
                data: { serviceOrderId: id, technicianId: dto.technicianId, role },
            })

        // ── Notificação ───────────────────────────────────────────
        const osData = await this.prisma.serviceOrder.findUnique({
            where: { id },
            select: {
                number: true, title: true, priority: true,
                client: { select: { name: true } },
                equipment: { select: { name: true } },
            },
        })

        if (osData) {
            await this.notificationsService.notify({
                event: NOTIFICATION_EVENTS.OS_TECHNICIAN_ASSIGNED,
                companyId,
                serviceOrderId: id,
                data: {
                    technicianId: dto.technicianId,
                    osNumber: osData.number,
                    osTitle: osData.title,
                    clientName: osData.client?.name ?? '',
                    equipmentName: osData.equipment?.name ?? '',
                    priority: osData.priority,
                },
            })
        }

        return result
    }

    async removeTechnician(
        id: string,
        technicianId: string,
        clientId: string | null,
        companyId: string,
    ) {
        await this.findExisting(id, clientId, companyId)

        const link = await this.prisma.serviceOrderTechnician.findUnique({
            where: {
                serviceOrderId_technicianId: { serviceOrderId: id, technicianId },
            },
            select: { id: true },
        })
        if (!link) throw new NotFoundException('Técnico não está vinculado a esta OS')

        await this.prisma.serviceOrderTechnician.update({
            where: {
                serviceOrderId_technicianId: { serviceOrderId: id, technicianId },
            },
            data: { releasedAt: new Date() },
        })

        return { message: 'Técnico removido da OS com sucesso' }
    }

    async update(
        id: string,
        dto: UpdateServiceOrderDto,
        clientId: string | null,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const os = await this.findExisting(id, clientId, companyId)

        if (os.status === ServiceOrderStatus.COMPLETED_APPROVED || os.status === ServiceOrderStatus.CANCELLED) {
            throw new ConflictException('Esta OS não pode ser editada no status atual')
        }

        if (currentUser.role === UserRole.TECHNICIAN) {
            const isLinked = await this.prisma.serviceOrderTechnician.findFirst({
                where: { serviceOrderId: id, technicianId: currentUser.sub, releasedAt: null },
                select: { id: true },
            })
            if (!isLinked) throw new ForbiddenException('Você não está vinculado a esta OS')

            return this.prisma.serviceOrder.update({
                where: { id },
                data: { ...(dto.resolution !== undefined && { resolution: dto.resolution }) },
                select: OS_SELECT,
            })
        }

        return this.prisma.serviceOrder.update({
            where: { id },
            data: {
                ...(dto.title && { title: dto.title }),
                ...(dto.description && { description: dto.description }),
                ...(dto.priority && { priority: dto.priority }),
                ...(dto.resolution !== undefined && { resolution: dto.resolution }),
                ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
                ...(dto.alertAfterHours !== undefined && { alertAfterHours: dto.alertAfterHours }),
                ...(dto.scheduledFor !== undefined && {
                    scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
                }),
                ...(dto.groupId !== undefined && {
                    group: dto.groupId ? { connect: { id: dto.groupId } } : { disconnect: true },
                }),
            },
            select: OS_SELECT,
        })
    }

    // ─────────────────────────────────────────
    // Mudar status + disparar notificação correta
    // ─────────────────────────────────────────
    async updateStatus(
        id: string,
        dto: UpdateServiceOrderStatusDto,
        clientId: string | null,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const os = await this.findExisting(id, clientId, companyId)

        const allowedTransitions = VALID_TRANSITIONS[os.status]
        if (!allowedTransitions.includes(dto.status)) {
            throw new BadRequestException(
                `Transição inválida: ${os.status} → ${dto.status}. ` +
                `Permitidas: ${allowedTransitions.join(', ') || 'nenhuma'}`,
            )
        }

        if (dto.status === ServiceOrderStatus.COMPLETED_APPROVED || dto.status === ServiceOrderStatus.COMPLETED_REJECTED) {
            if (!APPROVER_ROLES.includes(currentUser.role)) {
                throw new ForbiddenException('Apenas gestores podem aprovar ou reprovar uma OS')
            }
            if (dto.status === ServiceOrderStatus.COMPLETED_REJECTED && !dto.reason) {
                throw new BadRequestException('O motivo da reprovação é obrigatório')
            }
        }

        if (currentUser.role === UserRole.TECHNICIAN) {
            const isLinked = await this.prisma.serviceOrderTechnician.findFirst({
                where: { serviceOrderId: id, technicianId: currentUser.sub, releasedAt: null },
                select: { id: true },
            })
            if (!isLinked) throw new ForbiddenException('Você não está vinculado a esta OS')
            if (dto.status !== ServiceOrderStatus.COMPLETED) {
                throw new ForbiddenException('Técnicos só podem concluir uma OS')
            }
        }

        const statusData: Record<string, any> = {}
        if (dto.status === ServiceOrderStatus.IN_PROGRESS) statusData.startedAt = new Date()
        if (dto.status === ServiceOrderStatus.COMPLETED) {
            statusData.completedAt = new Date()
            if (dto.resolution) statusData.resolution = dto.resolution
        }
        if (dto.status === ServiceOrderStatus.COMPLETED_APPROVED || dto.status === ServiceOrderStatus.COMPLETED_REJECTED) {
            statusData.approvedAt = new Date()
            statusData.approvedById = currentUser.sub
        }

        let finalStatus = dto.status
        if (dto.status === ServiceOrderStatus.OPEN) {
            const hasTechnician = await this.prisma.serviceOrderTechnician.findFirst({
                where: { serviceOrderId: id, releasedAt: null },
                select: { id: true },
            })
            if (!hasTechnician) {
                finalStatus = ServiceOrderStatus.AWAITING_PICKUP
                statusData.isAvailable = true
            }
        }

        // Busca dados para notificação antes da transação
        const osDetails = await this.prisma.serviceOrder.findUnique({
            where: { id },
            select: {
                number: true,
                title: true,
                requesterId: true,
                clientId: true,
                resolution: true,
                technicians: {
                    where: { releasedAt: null },
                    select: { technician: { select: { id: true, name: true } } },
                },
            },
        })

        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.serviceOrder.update({
                where: { id },
                data: { status: finalStatus, ...statusData },
                select: OS_SELECT,
            })

            await tx.serviceOrderStatusHistory.create({
                data: {
                    serviceOrderId: id,
                    fromStatus: os.status,
                    toStatus: finalStatus,
                    changedById: currentUser.sub,
                    reason: dto.reason,
                },
            })

            // Se OS chegou a estado terminal, atualiza status do equipamento
            const TERMINAL: ServiceOrderStatus[] = [ServiceOrderStatus.COMPLETED_APPROVED, ServiceOrderStatus.CANCELLED]
            if (TERMINAL.includes(finalStatus) && os.equipmentId) {
                // OS de desativação aprovada → inativar o equipamento diretamente
                if (finalStatus === ServiceOrderStatus.COMPLETED_APPROVED && os.maintenanceType === MaintenanceType.DEACTIVATION) {
                    await tx.equipment.updateMany({
                        where: { id: os.equipmentId },
                        data: { status: EquipmentStatus.INACTIVE, lastMaintenanceAt: new Date() },
                    })
                } else {
                    // Demais casos: reverter para ACTIVE apenas se não houver mais OS ativas
                    const activeOsCount = await tx.serviceOrder.count({
                        where: {
                            equipmentId: os.equipmentId,
                            deletedAt: null,
                            status: { notIn: TERMINAL },
                        },
                    })
                    const equipmentUpdate: Record<string, unknown> = {}
                    if (activeOsCount === 0) equipmentUpdate.status = EquipmentStatus.ACTIVE
                    if (finalStatus === ServiceOrderStatus.COMPLETED_APPROVED) {
                        equipmentUpdate.lastMaintenanceAt = new Date()
                    }
                    if (Object.keys(equipmentUpdate).length > 0) {
                        await tx.equipment.updateMany({
                            where: { id: os.equipmentId, status: EquipmentStatus.UNDER_MAINTENANCE },
                            data: equipmentUpdate,
                        })
                    }
                }
            }

            return result
        })

        // ── Notificações por status ───────────────────────────────
        const notifyData = {
            osNumber: osDetails?.number,
            osTitle: osDetails?.title,
            requesterId: osDetails?.requesterId,
            clientId: osDetails?.clientId,
            technicianNames: osDetails?.technicians.map((t) => t.technician.name) ?? [],
            resolution: dto.resolution ?? osDetails?.resolution ?? '',
            reason: dto.reason,
        }

        if (finalStatus === ServiceOrderStatus.COMPLETED) {
            await this.notificationsService.notify({
                event: NOTIFICATION_EVENTS.OS_COMPLETED,
                companyId,
                serviceOrderId: id,
                data: notifyData,
            })
        } else if (finalStatus === ServiceOrderStatus.COMPLETED_APPROVED) {
            await this.notificationsService.notify({
                event: NOTIFICATION_EVENTS.OS_APPROVED,
                companyId,
                serviceOrderId: id,
                data: notifyData,
            })
        } else if (finalStatus === ServiceOrderStatus.COMPLETED_REJECTED) {
            await this.notificationsService.notify({
                event: NOTIFICATION_EVENTS.OS_REJECTED,
                companyId,
                serviceOrderId: id,
                data: notifyData,
            })
        }

        this.logger.log(`OS #${os.number}: ${os.status} → ${finalStatus} | ${currentUser.email}`)
        return updated
    }

    private async findExisting(id: string, clientId: string | null, companyId: string) {
        const os = await this.prisma.serviceOrder.findFirst({
            where: {
                id,
                companyId,
                deletedAt: null,
                ...(clientId && { OR: [{ clientId }, { clientId: null }] }),
            },
            select: { id: true, number: true, status: true, equipmentId: true, maintenanceType: true },
        })
        if (!os) throw new NotFoundException('Ordem de serviço não encontrada')
        return os
    }

    private buildCommentFilter(user: AuthenticatedUser) {
        const clientRoles: UserRole[] = [UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER, UserRole.CLIENT_VIEWER]
        if (clientRoles.includes(user.role)) return { isInternal: false }
        return {}
    }
}