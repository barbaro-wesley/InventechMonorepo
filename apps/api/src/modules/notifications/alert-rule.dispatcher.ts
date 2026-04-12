import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { EventType, NotificationChannel, NotificationStatus, UserRole } from '@prisma/client'
import type { AlertRuleCondition } from '@inventech/shared-types'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsGateway } from './notifications.gateway'
import { NOTIFICATION_QUEUE } from './notifications.constants'
import { buildUniversalEmail } from './channels/templates/universal.template'
import { evaluateConditions } from '../alert-rules/alert-rules.evaluator'
import { interpolate, EVENT_VARIABLE_REGISTRY } from '../alert-rules/alert-rules.variables'

type Recipient = { id: string; email?: string | null; telegramChatId?: string | null }

@Injectable()
export class AlertRuleDispatcher {
    private readonly logger = new Logger(AlertRuleDispatcher.name)

    private readonly JOB_OPTIONS = {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
    }

    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationsGateway,
        @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
    ) {}

    // ─────────────────────────────────────────
    // Ponto de entrada — chamado pelo dispatch() após os handlers fixos
    // ─────────────────────────────────────────
    async fireRules(
        event: EventType,
        data: Record<string, any>,
        companyId: string,
        serviceOrderId?: string,
    ): Promise<void> {
        const rules = await this.prisma.alertRule.findMany({
            where: { companyId, triggerEvent: event, isActive: true },
        })

        if (rules.length === 0) return

        await Promise.all(
            rules.map((rule) => this.processRule(rule, data, companyId, serviceOrderId)),
        )
    }

    // ─────────────────────────────────────────
    // Processa uma regra: avalia condições → resolve destinatários → envia
    // ─────────────────────────────────────────
    private async processRule(
        rule: Awaited<ReturnType<typeof this.prisma.alertRule.findMany>>[0],
        data: Record<string, any>,
        companyId: string,
        serviceOrderId?: string,
    ): Promise<void> {
        const conditions = rule.conditions as unknown as AlertRuleCondition[]

        if (!evaluateConditions(conditions, data)) {
            this.logger.debug(`Regra "${rule.name}" ignorada — condições não satisfeitas`)
            return
        }

        const recipients = await this.resolveRecipients(rule, companyId)

        if (recipients.length === 0) {
            this.logger.debug(`Regra "${rule.name}" sem destinatários resolvidos`)
            return
        }

        const template = this.buildTemplate(rule, data)

        await Promise.all([
            this.sendToRecipients(rule, recipients, template, companyId, serviceOrderId),
            this.prisma.alertRule.update({
                where: { id: rule.id },
                data: { fireCount: { increment: 1 }, lastFiredAt: new Date() },
            }),
        ])

        this.logger.log(`Regra "${rule.name}" disparada para ${recipients.length} destinatário(s)`)
    }

    // ─────────────────────────────────────────
    // Resolve destinatários pela regra (roles + grupos + usuários específicos)
    // ─────────────────────────────────────────
    private async resolveRecipients(
        rule: { recipientRoles: UserRole[]; recipientGroupIds: string[]; recipientUserIds: string[] },
        companyId: string,
    ): Promise<Recipient[]> {
        const queries: Promise<Recipient[]>[] = []

        if (rule.recipientRoles.length > 0) {
            queries.push(
                this.prisma.user.findMany({
                    where: {
                        companyId,
                        role: { in: rule.recipientRoles },
                        status: 'ACTIVE',
                    },
                    select: { id: true, email: true, telegramChatId: true },
                }),
            )
        }

        if (rule.recipientGroupIds.length > 0) {
            queries.push(
                this.prisma.user.findMany({
                    where: {
                        companyId,
                        status: 'ACTIVE',
                        technicianGroups: {
                            some: {
                                groupId: { in: rule.recipientGroupIds },
                                isActive: true,
                            },
                        },
                    },
                    select: { id: true, email: true, telegramChatId: true },
                }),
            )
        }

        if (rule.recipientUserIds.length > 0) {
            queries.push(
                this.prisma.user.findMany({
                    where: {
                        id: { in: rule.recipientUserIds },
                        companyId,
                        status: 'ACTIVE',
                    },
                    select: { id: true, email: true, telegramChatId: true },
                }),
            )
        }

        const results = await Promise.all(queries)
        const all = results.flat()

        // Remove duplicatas por id
        return [...new Map(all.map((u) => [u.id, u])).values()]
    }

    // ─────────────────────────────────────────
    // Constrói o template universal com os dados interpolados
    // ─────────────────────────────────────────
    private buildTemplate(
        rule: {
            triggerEvent: EventType
            headerColor: string
            headerTitle: string
            bodyTemplate: string
            tableFields: unknown
            buttonLabel: string | null
            buttonUrlTemplate: string | null
            footerNote: string | null
        },
        data: Record<string, any>,
    ) {
        const tableFields = rule.tableFields as string[]
        const variables = EVENT_VARIABLE_REGISTRY[rule.triggerEvent] ?? []

        const tableRows = tableFields
            .map((key) => {
                const def = variables.find((v) => v.key === key)
                const value = data[key]
                return def && value !== undefined
                    ? { label: def.label, value: String(value) }
                    : null
            })
            .filter(Boolean) as { label: string; value: string }[]

        const title = interpolate(rule.headerTitle, data)

        return buildUniversalEmail({
            subject: title,
            headerColor: rule.headerColor,
            headerTitle: title,
            bodyHtml: interpolate(rule.bodyTemplate, data),
            tableRows,
            buttonLabel: rule.buttonLabel ?? undefined,
            buttonUrl: rule.buttonUrlTemplate
                ? interpolate(rule.buttonUrlTemplate, data)
                : undefined,
            footerNote: rule.footerNote ?? undefined,
        })
    }

    // ─────────────────────────────────────────
    // Envia para todos os destinatários pelos canais configurados na regra
    // ─────────────────────────────────────────
    private async sendToRecipients(
        rule: { channels: NotificationChannel[]; name: string },
        recipients: Recipient[],
        template: { subject: string; html: string },
        companyId: string,
        serviceOrderId?: string,
    ): Promise<void> {
        await Promise.all(
            recipients.map(async (recipient) => {
                await Promise.all([
                    rule.channels.includes(NotificationChannel.WEBSOCKET)
                        ? this.saveAndSendWebSocket(recipient, template, companyId, serviceOrderId)
                        : Promise.resolve(),

                    rule.channels.includes(NotificationChannel.EMAIL) && recipient.email
                        ? this.saveAndSendEmail(recipient, template, companyId, serviceOrderId)
                        : Promise.resolve(),
                ])
            }),
        )
    }

    // Persiste no banco E envia pelo socket — assim o sino exibe a notificação
    private async saveAndSendWebSocket(
        recipient: Recipient,
        template: { subject: string; html: string },
        companyId: string,
        serviceOrderId?: string,
    ): Promise<void> {
        await this.prisma.notification.create({
            data: {
                companyId,
                userId: recipient.id,
                serviceOrderId,
                channel: NotificationChannel.WEBSOCKET,
                status: NotificationStatus.SENT,
                title: template.subject,
                body: '',
            },
        })

        this.gateway.sendToUser(recipient.id, {
            event: 'alert-rule',
            title: template.subject,
            body: '',
        })
    }

    private async saveAndSendEmail(
        recipient: Recipient,
        template: { subject: string; html: string },
        companyId: string,
        serviceOrderId?: string,
    ): Promise<void> {
        if (!recipient.email) return

        const notification = await this.prisma.notification.create({
            data: {
                companyId,
                userId: recipient.id,
                serviceOrderId,
                channel: NotificationChannel.EMAIL,
                status: NotificationStatus.PENDING,
                title: template.subject,
                body: template.html,
            },
        })

        await this.notificationQueue.add('send-tracked-email', {
            notificationId: notification.id,
            to: recipient.email,
            subject: template.subject,
            html: template.html,
        }, this.JOB_OPTIONS)
    }
}
