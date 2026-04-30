import { Injectable } from '@nestjs/common'
import {
    UserRole,
    NotificationChannel,
    ContextualRecipient,
    EventType,
    NotificationConfig,
} from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { UpsertNotificationConfigDto } from './dto/upsert-notification-config.dto'

export type RecipientUser = {
    id: string
    email?: string | null
    telegramChatId?: string | null
}

// Contexto passado ao resolver destinatários contextuais
export interface RecipientContext {
    groupId?: string
    groupIds?: string[]
    requesterId?: string
    technicianId?: string
    clientId?: string
    serviceOrderId?: string
}

// Defaults que espelham o comportamento hardcoded original
const DEFAULT_CONFIGS: Record<EventType, Pick<NotificationConfig, 'recipientRoles' | 'recipientContextual' | 'channels'>> = {
    [EventType.OS_CREATED_NO_TECHNICIAN]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_GROUP_TECHNICIANS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.OS_TECHNICIAN_ASSIGNED]: {
        recipientRoles: [],
        recipientContextual: [ContextualRecipient.OS_ASSIGNED_TECHNICIAN],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.OS_TECHNICIAN_ASSUMED]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_REQUESTER],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.OS_COMPLETED]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_REQUESTER, ContextualRecipient.OS_CLIENT_ADMINS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.OS_APPROVED]: {
        recipientRoles: [],
        recipientContextual: [ContextualRecipient.OS_ASSIGNED_TECHNICIANS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.OS_REJECTED]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_ASSIGNED_TECHNICIANS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.OS_UNASSIGNED_ALERT]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_GROUP_TECHNICIANS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.PREVENTIVE_GENERATED]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_GROUP_TECHNICIANS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.PREVENTIVE_UPCOMING]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [ContextualRecipient.OS_GROUP_TECHNICIANS],
        channels: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM, NotificationChannel.WEBSOCKET],
    },
    [EventType.DAILY_SUMMARY]: {
        recipientRoles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER],
        recipientContextual: [],
        channels: [NotificationChannel.EMAIL],
    },
    // Eventos sem config fixa — sem destinatários por padrão
    [EventType.EQUIPMENT_CREATED]: { recipientRoles: [], recipientContextual: [], channels: [] },
    [EventType.EQUIPMENT_MOVED]: { recipientRoles: [], recipientContextual: [], channels: [] },
    [EventType.EQUIPMENT_WARRANTY_EXPIRING]: { recipientRoles: [], recipientContextual: [], channels: [] },
    [EventType.MAINTENANCE_OVERDUE]: { recipientRoles: [], recipientContextual: [], channels: [] },
    [EventType.USER_CREATED]: { recipientRoles: [], recipientContextual: [], channels: [] },
    [EventType.USER_DEACTIVATED]: { recipientRoles: [], recipientContextual: [], channels: [] },
}

// Eventos exibidos na UI de configuração
export const CONFIGURABLE_EVENTS: EventType[] = [
    EventType.OS_CREATED_NO_TECHNICIAN,
    EventType.OS_TECHNICIAN_ASSIGNED,
    EventType.OS_TECHNICIAN_ASSUMED,
    EventType.OS_COMPLETED,
    EventType.OS_APPROVED,
    EventType.OS_REJECTED,
    EventType.OS_UNASSIGNED_ALERT,
    EventType.PREVENTIVE_GENERATED,
    EventType.PREVENTIVE_UPCOMING,
    EventType.DAILY_SUMMARY,
]

export const EVENT_LABELS: Record<string, string> = {
    [EventType.OS_CREATED_NO_TECHNICIAN]: 'OS criada sem técnico',
    [EventType.OS_TECHNICIAN_ASSIGNED]: 'Técnico designado',
    [EventType.OS_TECHNICIAN_ASSUMED]: 'Técnico assumiu OS',
    [EventType.OS_COMPLETED]: 'OS concluída',
    [EventType.OS_APPROVED]: 'OS aprovada',
    [EventType.OS_REJECTED]: 'OS reprovada',
    [EventType.OS_UNASSIGNED_ALERT]: 'OS sem técnico (alerta)',
    [EventType.PREVENTIVE_GENERATED]: 'Preventiva gerada',
    [EventType.PREVENTIVE_UPCOMING]: 'Preventivas próximas (30 dias)',
    [EventType.DAILY_SUMMARY]: 'Resumo diário',
}

export const CONTEXTUAL_LABELS: Record<ContextualRecipient, string> = {
    [ContextualRecipient.OS_REQUESTER]: 'Solicitante da OS',
    [ContextualRecipient.OS_ASSIGNED_TECHNICIANS]: 'Técnicos atribuídos à OS',
    [ContextualRecipient.OS_GROUP_TECHNICIANS]: 'Técnicos do grupo da OS',
    [ContextualRecipient.OS_CLIENT_ADMINS]: 'Admins do cliente da OS',
    [ContextualRecipient.OS_ASSIGNED_TECHNICIAN]: 'Técnico sendo designado',
}

@Injectable()
export class NotificationConfigsService {
    constructor(private prisma: PrismaService) {}

    // ─────────────────────────────────────────
    // Lista todos os eventos configuráveis com seus configs (ou defaults)
    // ─────────────────────────────────────────
    async findAll(companyId: string) {
        const saved = await this.prisma.notificationConfig.findMany({
            where: { companyId },
        })

        const savedMap = new Map(saved.map((c) => [c.eventType, c]))

        return CONFIGURABLE_EVENTS.map((eventType) => {
            const config = savedMap.get(eventType)
            const defaults = DEFAULT_CONFIGS[eventType]
            return {
                eventType,
                label: EVENT_LABELS[eventType],
                id: config?.id ?? null,
                isActive: config?.isActive ?? true,
                recipientRoles: config?.recipientRoles ?? defaults.recipientRoles,
                recipientContextual: config?.recipientContextual ?? defaults.recipientContextual,
                recipientGroupIds: config?.recipientGroupIds ?? [],
                recipientUserIds: config?.recipientUserIds ?? [],
                recipientCustomRoleIds: config?.recipientCustomRoleIds ?? [],
                channels: config?.channels ?? defaults.channels,
                isCustomized: !!config,
            }
        })
    }

    // ─────────────────────────────────────────
    // Cria ou atualiza config de um evento
    // ─────────────────────────────────────────
    async upsert(companyId: string, eventType: EventType, dto: UpsertNotificationConfigDto) {
        const defaults = DEFAULT_CONFIGS[eventType]
        return this.prisma.notificationConfig.upsert({
            where: { companyId_eventType: { companyId, eventType } },
            create: {
                companyId,
                eventType,
                isActive: dto.isActive ?? true,
                recipientRoles: dto.recipientRoles ?? defaults.recipientRoles,
                recipientContextual: dto.recipientContextual ?? defaults.recipientContextual,
                recipientGroupIds: dto.recipientGroupIds ?? [],
                recipientUserIds: dto.recipientUserIds ?? [],
                recipientCustomRoleIds: dto.recipientCustomRoleIds ?? [],
                channels: dto.channels ?? defaults.channels,
            },
            update: {
                isActive: dto.isActive ?? undefined,
                recipientRoles: dto.recipientRoles,
                recipientContextual: dto.recipientContextual,
                recipientGroupIds: dto.recipientGroupIds,
                recipientUserIds: dto.recipientUserIds,
                recipientCustomRoleIds: dto.recipientCustomRoleIds,
                channels: dto.channels,
            },
        })
    }

    // ─────────────────────────────────────────
    // Alterna isActive de um evento
    // ─────────────────────────────────────────
    async toggle(companyId: string, eventType: EventType) {
        const existing = await this.prisma.notificationConfig.findUnique({
            where: { companyId_eventType: { companyId, eventType } },
        })

        const currentActive = existing?.isActive ?? true
        const defaults = DEFAULT_CONFIGS[eventType]

        return this.prisma.notificationConfig.upsert({
            where: { companyId_eventType: { companyId, eventType } },
            create: {
                companyId,
                eventType,
                isActive: !currentActive,
                recipientRoles: defaults.recipientRoles,
                recipientContextual: defaults.recipientContextual,
                recipientGroupIds: [],
                recipientUserIds: [],
                recipientCustomRoleIds: [],
                channels: defaults.channels,
            },
            update: { isActive: !currentActive },
        })
    }

    // ─────────────────────────────────────────
    // Cria configs padrão para uma nova empresa
    // ─────────────────────────────────────────
    async seedDefaults(companyId: string) {
        const data = CONFIGURABLE_EVENTS.map((eventType) => {
            const defaults = DEFAULT_CONFIGS[eventType]
            return {
                companyId,
                eventType,
                isActive: true,
                recipientRoles: defaults.recipientRoles,
                recipientContextual: defaults.recipientContextual,
                recipientGroupIds: [] as string[],
                recipientUserIds: [] as string[],
                recipientCustomRoleIds: [] as string[],
                channels: defaults.channels,
            }
        })

        await this.prisma.notificationConfig.createMany({
            data,
            skipDuplicates: true,
        })
    }

    // ─────────────────────────────────────────
    // Resolve destinatários finais para um evento
    // Retorna [] se config estiver inativa
    // ─────────────────────────────────────────
    async resolveRecipients(
        companyId: string,
        eventType: EventType,
        context: RecipientContext,
    ): Promise<{ recipients: RecipientUser[]; channels: NotificationChannel[] }> {
        const saved = await this.prisma.notificationConfig.findUnique({
            where: { companyId_eventType: { companyId, eventType } },
        })

        const defaults = DEFAULT_CONFIGS[eventType]
        const isActive = saved?.isActive ?? true

        if (!isActive) {
            return { recipients: [], channels: [] }
        }

        const roles = saved?.recipientRoles ?? defaults.recipientRoles
        const contextuals = saved?.recipientContextual ?? defaults.recipientContextual
        const groupIds = saved?.recipientGroupIds ?? []
        const userIds = saved?.recipientUserIds ?? []
        const customRoleIds = saved?.recipientCustomRoleIds ?? []
        const channels = saved?.channels ?? defaults.channels

        const userSelect = { id: true, email: true, telegramChatId: true } as const

        const results = await Promise.all([
            // Por papel fixo (UserRole)
            roles.length > 0
                ? this.prisma.user.findMany({
                    where: { companyId, role: { in: roles }, status: 'ACTIVE', deletedAt: null },
                    select: userSelect,
                })
                : [],

            // Por destinatários contextuais
            ...contextuals.map((type) => this.resolveContextual(type, companyId, context, userSelect)),

            // Por grupos específicos configurados
            groupIds.length > 0
                ? this.prisma.user.findMany({
                    where: {
                        companyId,
                        status: 'ACTIVE',
                        deletedAt: null,
                        technicianGroups: { some: { groupId: { in: groupIds }, isActive: true } },
                    },
                    select: userSelect,
                })
                : [],

            // Por usuários específicos configurados
            userIds.length > 0
                ? this.prisma.user.findMany({
                    where: { id: { in: userIds }, companyId, status: 'ACTIVE', deletedAt: null },
                    select: userSelect,
                })
                : [],

            // Por papéis personalizados configurados
            customRoleIds.length > 0
                ? this.prisma.user.findMany({
                    where: { companyId, customRoleId: { in: customRoleIds }, status: 'ACTIVE', deletedAt: null },
                    select: userSelect,
                })
                : [],
        ])

        const flat = (results as RecipientUser[][]).flat()
        const deduped = [...new Map(flat.map((u) => [u.id, u])).values()]

        return { recipients: deduped, channels }
    }

    private async resolveContextual(
        type: ContextualRecipient,
        companyId: string,
        context: RecipientContext,
        select: { id: true; email: true; telegramChatId: true },
    ): Promise<RecipientUser[]> {
        switch (type) {
            case ContextualRecipient.OS_REQUESTER: {
                if (!context.requesterId) return []
                const user = await this.prisma.user.findFirst({
                    where: { id: context.requesterId, companyId, deletedAt: null },
                    select,
                })
                return user ? [user] : []
            }

            case ContextualRecipient.OS_ASSIGNED_TECHNICIAN: {
                if (!context.technicianId) return []
                const user = await this.prisma.user.findFirst({
                    where: { id: context.technicianId, companyId, deletedAt: null },
                    select,
                })
                return user ? [user] : []
            }

            case ContextualRecipient.OS_ASSIGNED_TECHNICIANS: {
                if (!context.serviceOrderId) return []
                return this.prisma.user.findMany({
                    where: {
                        companyId,
                        deletedAt: null,
                        serviceOrderTechnicians: {
                            some: { serviceOrderId: context.serviceOrderId, releasedAt: null },
                        },
                    },
                    select,
                })
            }

            case ContextualRecipient.OS_GROUP_TECHNICIANS: {
                const ids = context.groupIds ?? (context.groupId ? [context.groupId] : [])
                if (ids.length === 0) {
                    return []
                }
                const lists = await Promise.all(
                    ids.map((gId) =>
                        this.prisma.user.findMany({
                            where: {
                                companyId,
                                role: UserRole.TECHNICIAN,
                                status: 'ACTIVE',
                                deletedAt: null,
                                technicianGroups: { some: { groupId: gId, isActive: true } },
                            },
                            select,
                        }),
                    ),
                )
                const flat = lists.flat()
                return [...new Map(flat.map((u) => [u.id, u])).values()]
            }

            case ContextualRecipient.OS_CLIENT_ADMINS: {
                if (!context.clientId) return []
                return this.prisma.user.findMany({
                    where: {
                        companyId,
                        clientId: context.clientId,
                        role: UserRole.CLIENT_ADMIN,
                        status: 'ACTIVE',
                        deletedAt: null,
                    },
                    select,
                })
            }

            default:
                return []
        }
    }
}
