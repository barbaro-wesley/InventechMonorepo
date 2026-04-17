import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { NotificationChannel, NotificationStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { EmailChannel } from './channels/email.channel'
import { AlertRuleDispatcher } from './alert-rule.dispatcher'
import { buildOsCreatedEmail } from './channels/templates/os-created.template'
import { buildTechnicianAssignedEmail } from './channels/templates/technician-assigned.template'
import { buildOsCompletedEmail } from './channels/templates/os-completed.template'
import { buildOsRejectedEmail } from './channels/templates/os-rejected.template'
import { buildUnassignedAlertEmail } from './channels/templates/unassigned-alert.template'
import { buildDailySummaryEmail } from './channels/templates/daily-summary.template'
import { TelegramChannel } from './channels/telegram.channel'
import { NotificationsGateway } from './notifications.gateway'
import {
    NOTIFICATION_QUEUE,
    EventType,
    NotificationEvent,
} from './notifications.constants'
import { NotificationConfigsService, RecipientUser } from '../notification-configs/notification-configs.service'

export interface NotificationJobPayload {
    event: NotificationEvent
    data: Record<string, any>
    companyId: string
    serviceOrderId?: string
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name)

    constructor(
        private prisma: PrismaService,
        private emailChannel: EmailChannel,
        private telegramChannel: TelegramChannel,
        private gateway: NotificationsGateway,
        private alertRuleDispatcher: AlertRuleDispatcher,
        private notificationConfigs: NotificationConfigsService,
        @InjectQueue(NOTIFICATION_QUEUE) private notificationQueue: Queue,
    ) { }

    private readonly JOB_OPTIONS = {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
    }

    async notify(payload: NotificationJobPayload) {
        await this.notificationQueue.add('dispatch', payload, this.JOB_OPTIONS)
    }

    async queueAuthEmail(payload: { to: string; subject: string; html: string }): Promise<void> {
        await this.notificationQueue.add('send-auth-email', payload, this.JOB_OPTIONS)
    }

    async sendAuthEmailJob(payload: { to: string; subject: string; html: string }): Promise<void> {
        await this.emailChannel.send(payload)
    }

    async sendTrackedEmailJob(payload: { notificationId: string; to: string; subject: string; html: string }): Promise<void> {
        try {
            await this.emailChannel.send({ to: payload.to, subject: payload.subject, html: payload.html })
            await this.prisma.notification.update({
                where: { id: payload.notificationId },
                data: { status: NotificationStatus.SENT, sentAt: new Date() },
            })
        } catch (error) {
            await this.prisma.notification.update({
                where: { id: payload.notificationId },
                data: {
                    status: NotificationStatus.FAILED,
                    failedAt: new Date(),
                    failReason: error.message,
                    retryCount: { increment: 1 },
                },
            })
            throw error
        }
    }

    async dispatch(payload: NotificationJobPayload): Promise<void> {
        const { event, data, companyId, serviceOrderId } = payload
        this.logger.log(`Disparando notificação: ${event} | Empresa: ${companyId}`)

        switch (event) {
            case EventType.OS_CREATED_NO_TECHNICIAN:
                await this.notifyOsCreatedNoTechnician(data, companyId, serviceOrderId)
                break
            case EventType.OS_TECHNICIAN_ASSIGNED:
                await this.notifyTechnicianAssigned(data, companyId, serviceOrderId)
                break
            case EventType.OS_TECHNICIAN_ASSUMED:
                await this.notifyTechnicianAssumed(data, companyId, serviceOrderId)
                break
            case EventType.OS_COMPLETED:
                await this.notifyOsCompleted(data, companyId, serviceOrderId)
                break
            case EventType.OS_APPROVED:
                await this.notifyOsApproved(data, companyId, serviceOrderId)
                break
            case EventType.OS_REJECTED:
                await this.notifyOsRejected(data, companyId, serviceOrderId)
                break
            case EventType.OS_UNASSIGNED_ALERT:
                await this.notifyUnassignedAlert(data, companyId, serviceOrderId)
                break
            case EventType.PREVENTIVE_GENERATED:
                await this.notifyPreventiveGenerated(data, companyId, serviceOrderId)
                break
            case EventType.PREVENTIVE_UPCOMING:
                await this.notifyPreventiveUpcoming(data, companyId)
                break
            case EventType.DAILY_SUMMARY:
                await this.sendDailySummary(data, companyId)
                break
            default:
                this.logger.warn(`Evento desconhecido: ${event}`)
        }

        await this.alertRuleDispatcher
            .fireRules(event, data, companyId, serviceOrderId)
            .catch((err) =>
                this.logger.error(`Erro ao disparar regras de alerta para evento ${event}: ${err.message}`),
            )
    }

    private async notifyOsCreatedNoTechnician(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_CREATED_NO_TECHNICIAN, { groupId: data.groupId, serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: buildOsCreatedEmail(data),
            telegram: this.telegramChannel.buildOsCreatedMessage(data),
            ws: { event: EventType.OS_CREATED_NO_TECHNICIAN, title: 'Nova OS no painel', body: `OS #${data.osNumber} — ${data.osTitle}`, data },
            companyId,
            serviceOrderId,
        })

        this.gateway.sendPanelUpdate(companyId, {
            event: 'os.panel.new',
            title: 'Nova OS disponível',
            body: `OS #${data.osNumber} — ${data.osTitle}`,
            data: { serviceOrderId },
        })
    }

    private async notifyTechnicianAssigned(data: any, companyId: string, serviceOrderId?: string) {
        const technician = await this.prisma.user.findUnique({
            where: { id: data.technicianId },
            select: { id: true, email: true, telegramChatId: true, name: true },
        })
        if (!technician) return

        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_TECHNICIAN_ASSIGNED, { technicianId: data.technicianId, serviceOrderId },
        )

        const emailTemplate = buildTechnicianAssignedEmail({ technicianName: technician.name, ...data })
        const telegramMsg = this.telegramChannel.buildTechnicianAssignedMessage({ technicianName: technician.name, ...data })

        await this.sendToRecipients(recipients, channels, {
            email: emailTemplate,
            telegram: telegramMsg,
            ws: { event: EventType.OS_TECHNICIAN_ASSIGNED, title: 'OS atribuída a você', body: `OS #${data.osNumber} — ${data.osTitle}`, data },
            companyId,
            serviceOrderId,
        })

        if (serviceOrderId) {
            this.gateway.sendOsUpdate(serviceOrderId, {
                event: 'os.technician.assigned',
                title: 'Técnico atribuído',
                body: `${technician.name} foi atribuído a esta OS`,
                data: { technician: { id: technician.id, name: technician.name } },
            })
        }
    }

    private async notifyTechnicianAssumed(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_TECHNICIAN_ASSUMED, { requesterId: data.requesterId, serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: {
                subject: `🔧 OS #${data.osNumber} assumida por ${data.technicianName}`,
                html: `<p>A OS <strong>#${data.osNumber} — ${data.osTitle}</strong> foi assumida por <strong>${data.technicianName}</strong> e está em andamento.</p>`,
            },
            telegram: `🔧 <b>OS assumida</b>\n\nOS <b>#${data.osNumber}</b> foi assumida por <b>${data.technicianName}</b> e está em andamento.`,
            ws: { event: EventType.OS_TECHNICIAN_ASSUMED, title: 'OS em andamento', body: `${data.technicianName} assumiu a OS #${data.osNumber}`, data },
            companyId,
            serviceOrderId,
        })

        this.gateway.sendPanelUpdate(companyId, {
            event: 'os.panel.removed',
            title: 'OS removida do painel',
            body: `OS #${data.osNumber} foi assumida`,
            data: { serviceOrderId },
        })

        if (serviceOrderId) {
            this.gateway.sendOsUpdate(serviceOrderId, {
                event: 'os.status.changed',
                title: 'Status atualizado',
                body: 'OS em andamento',
                data: { status: 'IN_PROGRESS' },
            })
        }
    }

    private async notifyOsCompleted(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_COMPLETED, { requesterId: data.requesterId, clientId: data.clientId, serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: buildOsCompletedEmail(data),
            telegram: this.telegramChannel.buildOsCompletedMessage(data),
            ws: { event: EventType.OS_COMPLETED, title: 'OS concluída — aguardando aprovação', body: `OS #${data.osNumber} — ${data.osTitle}`, data },
            companyId,
            serviceOrderId,
        })

        if (serviceOrderId) {
            this.gateway.sendOsUpdate(serviceOrderId, {
                event: 'os.status.changed',
                title: 'OS concluída',
                body: 'Aguardando aprovação',
                data: { status: 'COMPLETED' },
            })
        }
    }

    private async notifyOsApproved(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_APPROVED, { serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: {
                subject: `✅ OS #${data.osNumber} aprovada`,
                html: `<p>A OS <strong>#${data.osNumber} — ${data.osTitle}</strong> foi <strong>aprovada</strong>.</p>`,
            },
            telegram: `✅ <b>OS aprovada</b>\n\nOS <b>#${data.osNumber} — ${data.osTitle}</b> foi aprovada.`,
            ws: { event: EventType.OS_APPROVED, title: 'OS aprovada', body: `OS #${data.osNumber} foi aprovada`, data },
            companyId,
            serviceOrderId,
        })

        if (serviceOrderId) {
            this.gateway.sendOsUpdate(serviceOrderId, {
                event: 'os.status.changed',
                title: 'OS aprovada',
                body: 'OS finalizada com sucesso',
                data: { status: 'COMPLETED_APPROVED' },
            })
        }
    }

    private async notifyOsRejected(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_REJECTED, { serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: buildOsRejectedEmail(data),
            telegram: this.telegramChannel.buildOsRejectedMessage(data),
            ws: { event: EventType.OS_REJECTED, title: 'OS reprovada', body: `OS #${data.osNumber} — ${data.reason}`, data },
            companyId,
            serviceOrderId,
        })

        if (serviceOrderId) {
            this.gateway.sendOsUpdate(serviceOrderId, {
                event: 'os.status.changed',
                title: 'OS reprovada',
                body: data.reason,
                data: { status: 'COMPLETED_REJECTED' },
            })
        }
    }

    private async notifyUnassignedAlert(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.OS_UNASSIGNED_ALERT, { groupId: data.groupId, serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: buildUnassignedAlertEmail(data),
            telegram: this.telegramChannel.buildUnassignedAlertMessage(data),
            ws: { event: EventType.OS_UNASSIGNED_ALERT, title: `⚠️ OS sem técnico há ${data.hoursWaiting}h`, body: `OS #${data.osNumber} — ${data.osTitle}`, data },
            companyId,
            serviceOrderId,
        })
    }

    private async notifyPreventiveGenerated(data: any, companyId: string, serviceOrderId?: string) {
        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.PREVENTIVE_GENERATED, { groupId: data.groupId, serviceOrderId },
        )

        await this.sendToRecipients(recipients, channels, {
            email: {
                subject: `🔧 Preventiva gerada — OS #${data.osNumber}`,
                html: `<p>OS preventiva <strong>#${data.osNumber}</strong> gerada automaticamente para o equipamento <strong>${data.equipmentName}</strong>.</p>`,
            },
            telegram: this.telegramChannel.buildPreventiveGeneratedMessage(data),
            ws: { event: EventType.PREVENTIVE_GENERATED, title: 'Preventiva gerada', body: `OS #${data.osNumber} — ${data.equipmentName}`, data },
            companyId,
            serviceOrderId,
        })

        this.gateway.sendPanelUpdate(companyId, {
            event: 'os.panel.new',
            title: 'Nova preventiva no painel',
            body: `OS #${data.osNumber} — ${data.equipmentName}`,
            data: { serviceOrderId },
        })
    }

    private async notifyPreventiveUpcoming(data: any, companyId: string) {
        const { daysAhead, count, schedules } = data as {
            daysAhead: number
            count: number
            schedules: Array<{
                scheduleId: string
                title: string
                nextRunAt: string
                clientId: string | null
                clientName: string
                equipmentName: string
                groupId: string | null
                groupName: string
            }>
        }

        const groupIds = [...new Set(schedules.map((s) => s.groupId).filter(Boolean))] as string[]

        const { recipients, channels } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.PREVENTIVE_UPCOMING, { groupIds },
        )

        const rows = schedules
            .map((s) => {
                const date = new Date(s.nextRunAt).toLocaleDateString('pt-BR')
                return `<tr><td>${s.title}</td><td>${s.equipmentName}</td><td>${date}</td><td>${s.clientName || '—'}</td><td>${s.groupName || '—'}</td></tr>`
            })
            .join('')

        const html = `
<h2>Preventivas agendadas nos próximos ${daysAhead} dias</h2>
<p><strong>${count}</strong> preventiva(s) programada(s).</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
  <thead><tr><th>Título</th><th>Equipamento</th><th>Data prevista</th><th>Cliente</th><th>Grupo</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`

        const telegramMsg = `📅 <b>Preventivas nos próximos ${daysAhead} dias</b>\n\n` +
            schedules.map((s) => {
                const date = new Date(s.nextRunAt).toLocaleDateString('pt-BR')
                return `• <b>${s.title}</b> — ${s.equipmentName} — ${date}${s.clientName ? ` (${s.clientName})` : ''}`
            }).join('\n')

        await this.sendToRecipients(recipients, channels, {
            email: { subject: `📅 ${count} preventiva(s) agendada(s) nos próximos ${daysAhead} dias`, html },
            telegram: telegramMsg,
            ws: { event: EventType.PREVENTIVE_UPCOMING, title: `${count} preventiva(s) nos próximos ${daysAhead} dias`, body: 'Verifique o planejamento de manutenções preventivas', data },
            companyId,
        })
    }

    private async sendDailySummary(data: any, companyId: string) {
        const [open, inProgress, completedPending, overdue] = await Promise.all([
            this.prisma.serviceOrder.count({ where: { companyId, status: 'AWAITING_PICKUP', deletedAt: null } }),
            this.prisma.serviceOrder.count({ where: { companyId, status: 'IN_PROGRESS', deletedAt: null } }),
            this.prisma.serviceOrder.count({ where: { companyId, status: 'COMPLETED', deletedAt: null } }),
            this.prisma.serviceOrder.count({ where: { companyId, isAvailable: true, alertSentAt: { not: null }, deletedAt: null } }),
        ])

        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true },
        })

        const { recipients } = await this.notificationConfigs.resolveRecipients(
            companyId, EventType.DAILY_SUMMARY, {},
        )

        const date = new Date().toLocaleDateString('pt-BR')
        const emailTemplate = buildDailySummaryEmail({
            companyName: company?.name ?? '',
            date,
            openCount: open,
            inProgressCount: inProgress,
            completedPendingCount: completedPending,
            overdueCount: overdue,
        })

        for (const admin of recipients) {
            if (admin.email) {
                await this.saveAndSendEmail(admin.id, companyId, emailTemplate, undefined)
            }
        }
    }

    // ─────────────────────────────────────────
    // Envio unificado — respeita canais configurados
    // ─────────────────────────────────────────
    private async sendToRecipients(
        recipients: RecipientUser[],
        channels: NotificationChannel[],
        options: {
            email: { subject: string; html: string }
            telegram: string
            ws: { event: string; title: string; body: string; data?: any }
            companyId: string
            serviceOrderId?: string
        },
    ) {
        const sendEmail = channels.includes(NotificationChannel.EMAIL)
        const sendTelegram = channels.includes(NotificationChannel.TELEGRAM)
        const sendWs = channels.includes(NotificationChannel.WEBSOCKET)

        await Promise.all(recipients.map(async (recipient) => {
            if (sendWs) {
                this.gateway.sendToUser(recipient.id, options.ws)
            }

            await Promise.all([
                sendEmail
                    ? this.saveAndSendEmail(recipient.id, options.companyId, options.email, options.serviceOrderId)
                    : Promise.resolve(),
                sendTelegram && recipient.telegramChatId
                    ? this.saveAndSendTelegram(recipient.id, options.companyId, recipient.telegramChatId, options.telegram, options.serviceOrderId)
                    : Promise.resolve(),
            ])
        }))
    }

    private async saveAndSendEmail(
        userId: string,
        companyId: string,
        template: { subject: string; html: string },
        serviceOrderId?: string,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        })
        if (!user?.email) return

        const notification = await this.prisma.notification.create({
            data: {
                companyId,
                userId,
                serviceOrderId,
                channel: NotificationChannel.EMAIL,
                status: NotificationStatus.PENDING,
                title: template.subject,
                body: template.html,
            },
        })

        await this.notificationQueue.add('send-tracked-email', {
            notificationId: notification.id,
            to: user.email,
            subject: template.subject,
            html: template.html,
        }, this.JOB_OPTIONS)
    }

    private async saveAndSendTelegram(
        userId: string,
        companyId: string,
        chatId: string,
        message: string,
        serviceOrderId?: string,
    ) {
        const notification = await this.prisma.notification.create({
            data: {
                companyId,
                userId,
                serviceOrderId,
                channel: NotificationChannel.TELEGRAM,
                status: NotificationStatus.PENDING,
                title: message.substring(0, 100),
                body: message,
                metadata: { chatId },
            },
        })

        try {
            await this.telegramChannel.send({ chatId, message })
            await this.prisma.notification.update({
                where: { id: notification.id },
                data: { status: NotificationStatus.SENT, sentAt: new Date() },
            })
        } catch (error) {
            await this.prisma.notification.update({
                where: { id: notification.id },
                data: {
                    status: NotificationStatus.FAILED,
                    failedAt: new Date(),
                    failReason: error.message,
                    retryCount: { increment: 1 },
                },
            })
        }
    }

    // ─────────────────────────────────────────
    // Notificações do usuário
    // ─────────────────────────────────────────
    async findUserNotifications(userId: string, page = 1, limit = 20) {
        const where = { userId }
        const [data, total, unread] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    channel: true,
                    status: true,
                    title: true,
                    body: true,
                    readAt: true,
                    createdAt: true,
                    serviceOrderId: true,
                },
            }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({ where: { userId, readAt: null } }),
        ])

        return { data, total, unread, page, limit }
    }

    async markAsRead(notificationId: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { readAt: new Date() },
        })
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        })
    }
}
