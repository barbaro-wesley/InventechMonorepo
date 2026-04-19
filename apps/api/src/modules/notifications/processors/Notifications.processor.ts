import { Processor, Process, OnQueueFailed, OnQueueStalled } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { ConfigService } from '@nestjs/config'
import { NotificationsService, NotificationJobPayload } from '../notifications.service'
import { EmailChannel } from '../channels/email.channel'
import { NOTIFICATION_QUEUE } from '../notifications.constants'

@Processor(NOTIFICATION_QUEUE)
export class NotificationsProcessor {
    private readonly logger = new Logger(NotificationsProcessor.name)

    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly emailChannel: EmailChannel,
        private readonly configService: ConfigService,
    ) { }

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
    async onFailed(job: Job, error: Error) {
        const maxAttempts = job.opts.attempts ?? 3
        const isFinalFailure = job.attemptsMade >= maxAttempts

        this.logger.error(
            `Job falhou: ${job.name} (job: ${job.id}) | ` +
            `Tentativa: ${job.attemptsMade}/${maxAttempts} | Erro: ${error.message}`,
        )

        if (isFinalFailure) {
            this.logger.error(
                `[DEAD_LETTER] Job ${job.name} (id: ${job.id}) esgotou todas as tentativas. ` +
                `Payload: ${JSON.stringify(job.data)}`,
            )
            await this.sendDeadLetterAlert(job, error)
        }
    }

    @OnQueueStalled()
    onStalled(job: Job) {
        this.logger.warn(`Job travado (stalled): ${job.name} (job: ${job.id}) — será reprocessado`)
    }

    private async sendDeadLetterAlert(job: Job, error: Error): Promise<void> {
        const adminEmail = this.configService.get<string>('ADMIN_ALERT_EMAIL')
        if (!adminEmail) return

        try {
            await this.emailChannel.send({
                to: adminEmail,
                subject: `[ALERTA] Job "${job.name}" falhou definitivamente`,
                html: `
                    <h2>Job esgotou todas as tentativas</h2>
                    <p><strong>Fila:</strong> ${NOTIFICATION_QUEUE}</p>
                    <p><strong>Job:</strong> ${job.name} (id: ${job.id})</p>
                    <p><strong>Tentativas:</strong> ${job.attemptsMade}</p>
                    <p><strong>Erro:</strong> ${error.message}</p>
                    <p><strong>Horário:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    <pre style="background:#f5f5f5;padding:12px">${JSON.stringify(job.data, null, 2)}</pre>
                `,
            })
        } catch (alertErr) {
            this.logger.error(`Falha ao enviar alerta de dead letter: ${alertErr.message}`)
        }
    }
}
