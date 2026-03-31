import { Processor, Process, OnQueueFailed } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { NotificationsService, NotificationJobPayload } from '../notifications.service'
import { NOTIFICATION_QUEUE } from '../notifications.constants'

@Processor(NOTIFICATION_QUEUE)
export class NotificationsProcessor {
    private readonly logger = new Logger(NotificationsProcessor.name)

    constructor(private readonly notificationsService: NotificationsService) { }

    // ── Notificações de negócio (OS, manutenção, etc.) ──────────────────────
    @Process('dispatch')
    async handleDispatch(job: Job<NotificationJobPayload>) {
        this.logger.log(`Processando notificação: ${job.data.event} (job: ${job.id})`)
        await this.notificationsService.dispatch(job.data)
    }

    // ── Emails de auth (2FA, reset de senha, verificação) ───────────────────
    @Process('send-auth-email')
    async handleAuthEmail(job: Job<{ to: string; subject: string; html: string }>) {
        this.logger.log(`Enviando email de auth para: ${job.data.to} (job: ${job.id})`)
        await this.notificationsService.sendAuthEmailJob(job.data)
    }

    // ── Emails rastreados (salvo na tabela Notification com status) ──────────
    @Process('send-tracked-email')
    async handleTrackedEmail(job: Job<{ notificationId: string; to: string; subject: string; html: string }>) {
        this.logger.log(`Enviando email rastreado: notificationId=${job.data.notificationId} (job: ${job.id})`)
        await this.notificationsService.sendTrackedEmailJob(job.data)
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `Job falhou: ${job.name} (job: ${job.id}) | ` +
            `Tentativa: ${job.attemptsMade} | Erro: ${error.message}`,
        )
    }
}