import { api } from "@/lib/api";

export type ContextualRecipient =
    | "OS_REQUESTER"
    | "OS_ASSIGNED_TECHNICIANS"
    | "OS_GROUP_TECHNICIANS"
    | "OS_CLIENT_ADMINS"
    | "OS_ASSIGNED_TECHNICIAN";

export type NotificationChannel = "EMAIL" | "TELEGRAM" | "WEBSOCKET";

export type UserRole =
    | "SUPER_ADMIN"
    | "COMPANY_ADMIN"
    | "COMPANY_MANAGER"
    | "TECHNICIAN"
    | "CLIENT_ADMIN"
    | "CLIENT_USER"
    | "CLIENT_VIEWER"
    | "MEMBER";

export type EventType =
    | "OS_CREATED_NO_TECHNICIAN"
    | "OS_TECHNICIAN_ASSIGNED"
    | "OS_TECHNICIAN_ASSUMED"
    | "OS_COMPLETED"
    | "OS_APPROVED"
    | "OS_REJECTED"
    | "OS_UNASSIGNED_ALERT"
    | "PREVENTIVE_GENERATED"
    | "PREVENTIVE_UPCOMING"
    | "DAILY_SUMMARY";

export interface NotificationConfigItem {
    eventType: EventType;
    label: string;
    id: string | null;
    isActive: boolean;
    recipientRoles: UserRole[];
    recipientContextual: ContextualRecipient[];
    recipientGroupIds: string[];
    recipientUserIds: string[];
    recipientCustomRoleIds: string[];
    channels: NotificationChannel[];
    isCustomized: boolean;
}

export interface UpsertNotificationConfigDto {
    isActive?: boolean;
    recipientRoles?: UserRole[];
    recipientContextual?: ContextualRecipient[];
    recipientGroupIds?: string[];
    recipientUserIds?: string[];
    recipientCustomRoleIds?: string[];
    channels?: NotificationChannel[];
}

export const CONTEXTUAL_LABELS: Record<ContextualRecipient, string> = {
    OS_REQUESTER: "Solicitante da OS",
    OS_ASSIGNED_TECHNICIANS: "Técnicos atribuídos à OS",
    OS_GROUP_TECHNICIANS: "Técnicos do grupo da OS",
    OS_CLIENT_ADMINS: "Admins do cliente da OS",
    OS_ASSIGNED_TECHNICIAN: "Técnico sendo designado",
};

export const ROLE_LABELS: Partial<Record<UserRole, string>> = {
    COMPANY_ADMIN: "Administrador",
    COMPANY_MANAGER: "Gerente",
    TECHNICIAN: "Técnico",
    CLIENT_ADMIN: "Admin do Cliente",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
    EMAIL: "Email",
    TELEGRAM: "Telegram",
    WEBSOCKET: "Notificação in-app",
};

export const CHANNEL_ICONS: Record<NotificationChannel, string> = {
    EMAIL: "📧",
    TELEGRAM: "💬",
    WEBSOCKET: "🔔",
};

export const notificationConfigsService = {
    async list(): Promise<NotificationConfigItem[]> {
        const { data } = await api.get("/notification-configs");
        return data;
    },

    async upsert(eventType: EventType, dto: UpsertNotificationConfigDto): Promise<NotificationConfigItem> {
        const { data } = await api.put(`/notification-configs/${eventType}`, dto);
        return data;
    },

    async toggle(eventType: EventType): Promise<NotificationConfigItem> {
        const { data } = await api.patch(`/notification-configs/${eventType}/toggle`);
        return data;
    },
};
