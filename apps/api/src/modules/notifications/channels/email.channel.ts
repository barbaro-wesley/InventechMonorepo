import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'

export { buildOsCreatedEmail } from './templates/os-created.template'
export { buildTechnicianAssignedEmail } from './templates/technician-assigned.template'
export { buildOsCompletedEmail } from './templates/os-completed.template'
export { buildOsRejectedEmail } from './templates/os-rejected.template'
export { buildUnassignedAlertEmail } from './templates/unassigned-alert.template'
export { buildDailySummaryEmail } from './templates/daily-summary.template'

export interface EmailPayload {
    to: string | string[]
    subject: string
    html: string
    text?: string  // fallback plaintext
}

@Injectable()
export class EmailChannel {
    private readonly logger = new Logger(EmailChannel.name)
    private transporter: Transporter

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('mail.host'),
            port: this.configService.get<number>('mail.port'),
            secure: this.configService.get<boolean>('mail.secure'),
            auth: {
                user: this.configService.get<string>('mail.user'),
                pass: this.configService.get<string>('mail.password'),
            },
            ignoreTLS: this.configService.get<boolean>('mail.ignoreTLS'),
        })
    }

    async send(payload: EmailPayload): Promise<void> {
        const from = {
            name: this.configService.get<string>('mail.from.name', 'Sistema de Manutenção'),
            address: this.configService.get<string>('mail.from.address', ''),
        }

        await this.transporter.sendMail({
            from: `"${from.name}" <${from.address}>`,
            to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
        })

        const recipients = Array.isArray(payload.to) ? payload.to.length : 1
        this.logger.log(`Email enviado: "${payload.subject}" → ${recipients} destinatário(s)`)
    }

}