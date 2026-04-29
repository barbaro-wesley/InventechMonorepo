import { ContextualRecipient, EventType, UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

// ─────────────────────────────────────────
// Contexto extraído dos dados do evento para resolver destinatários contextuais
// ─────────────────────────────────────────
export interface RecipientContext {
    groupId?: string
    groupIds?: string[]
    requesterId?: string
    technicianId?: string
    clientId?: string
    serviceOrderId?: string
}

export type RecipientUser = {
    id: string
    email?: string | null
    telegramChatId?: string | null
}

// Mapeamento de EventType → campos do data que compõem o contexto
export function extractContext(
    event: EventType,
    data: Record<string, any>,
    serviceOrderId?: string,
): RecipientContext {
    const base: RecipientContext = { serviceOrderId }

    switch (event) {
        case EventType.OS_CREATED_NO_TECHNICIAN:
            return { ...base, groupId: data.groupId, clientId: data.clientId }

        case EventType.OS_TECHNICIAN_ASSIGNED:
            return { ...base, technicianId: data.technicianId }

        case EventType.OS_TECHNICIAN_ASSUMED:
            return { ...base, requesterId: data.requesterId }

        case EventType.OS_COMPLETED:
            return { ...base, requesterId: data.requesterId, clientId: data.clientId }

        case EventType.OS_APPROVED:
        case EventType.OS_REJECTED:
            return { ...base }

        case EventType.OS_UNASSIGNED_ALERT:
            return { ...base, groupId: data.groupId, clientId: data.clientId }

        case EventType.PREVENTIVE_GENERATED:
            return { ...base, groupId: data.groupId }

        case EventType.PREVENTIVE_UPCOMING: {
            const groupIds = Array.isArray(data.groupIds) ? data.groupIds : []
            return { ...base, groupIds }
        }

        default:
            return base
    }
}

// ─────────────────────────────────────────
// Resolve destinatários contextuais para um único ContextualRecipient
// ─────────────────────────────────────────
export async function resolveContextualRecipient(
    type: ContextualRecipient,
    companyId: string,
    context: RecipientContext,
    prisma: PrismaService,
): Promise<RecipientUser[]> {
    const select = { id: true, email: true, telegramChatId: true } as const

    switch (type) {
        case ContextualRecipient.OS_REQUESTER: {
            if (!context.requesterId) return []
            const user = await prisma.user.findUnique({ where: { id: context.requesterId }, select })
            return user ? [user] : []
        }

        case ContextualRecipient.OS_ASSIGNED_TECHNICIAN: {
            if (!context.technicianId) return []
            const user = await prisma.user.findUnique({ where: { id: context.technicianId }, select })
            return user ? [user] : []
        }

        case ContextualRecipient.OS_ASSIGNED_TECHNICIANS: {
            if (!context.serviceOrderId) return []
            return prisma.user.findMany({
                where: {
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
                return prisma.user.findMany({
                    where: { companyId, role: UserRole.TECHNICIAN, status: 'ACTIVE', deletedAt: null },
                    select,
                })
            }
            const lists = await Promise.all(
                ids.map((gId) =>
                    prisma.user.findMany({
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
            return prisma.user.findMany({
                where: {
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

// ─────────────────────────────────────────
// Labels disponíveis por ContextualRecipient (para uso no frontend)
// ─────────────────────────────────────────
export const CONTEXTUAL_LABELS: Record<ContextualRecipient, string> = {
    [ContextualRecipient.OS_REQUESTER]:             'Solicitante da OS',
    [ContextualRecipient.OS_ASSIGNED_TECHNICIANS]:  'Técnicos atribuídos à OS',
    [ContextualRecipient.OS_GROUP_TECHNICIANS]:     'Técnicos do grupo da OS',
    [ContextualRecipient.OS_CLIENT_ADMINS]:         'Admins do cliente da OS',
    [ContextualRecipient.OS_ASSIGNED_TECHNICIAN]:   'Técnico sendo designado',
}

// ─────────────────────────────────────────
// Contextuais válidos por EventType (para expor no meta/variables)
// ─────────────────────────────────────────
export const CONTEXTUAL_BY_EVENT: Partial<Record<EventType, ContextualRecipient[]>> = {
    [EventType.OS_CREATED_NO_TECHNICIAN]: [
        ContextualRecipient.OS_GROUP_TECHNICIANS,
        ContextualRecipient.OS_CLIENT_ADMINS,
    ],
    [EventType.OS_TECHNICIAN_ASSIGNED]: [
        ContextualRecipient.OS_ASSIGNED_TECHNICIAN,
        ContextualRecipient.OS_REQUESTER,
    ],
    [EventType.OS_TECHNICIAN_ASSUMED]: [
        ContextualRecipient.OS_REQUESTER,
        ContextualRecipient.OS_ASSIGNED_TECHNICIANS,
    ],
    [EventType.OS_COMPLETED]: [
        ContextualRecipient.OS_REQUESTER,
        ContextualRecipient.OS_CLIENT_ADMINS,
        ContextualRecipient.OS_ASSIGNED_TECHNICIANS,
    ],
    [EventType.OS_APPROVED]: [
        ContextualRecipient.OS_ASSIGNED_TECHNICIANS,
        ContextualRecipient.OS_REQUESTER,
    ],
    [EventType.OS_REJECTED]: [
        ContextualRecipient.OS_ASSIGNED_TECHNICIANS,
        ContextualRecipient.OS_REQUESTER,
    ],
    [EventType.OS_UNASSIGNED_ALERT]: [
        ContextualRecipient.OS_GROUP_TECHNICIANS,
        ContextualRecipient.OS_CLIENT_ADMINS,
    ],
    [EventType.PREVENTIVE_GENERATED]: [
        ContextualRecipient.OS_GROUP_TECHNICIANS,
    ],
    [EventType.PREVENTIVE_UPCOMING]: [
        ContextualRecipient.OS_GROUP_TECHNICIANS,
    ],
}
