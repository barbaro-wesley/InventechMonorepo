import { Injectable, Logger } from '@nestjs/common'
import { ESignDocument, ESignRequest } from '@prisma/client'
import * as nodemailer from 'nodemailer'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ESignNotificationsService {
  private readonly logger = new Logger(ESignNotificationsService.name)
  private transporter: nodemailer.Transporter

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: this.config.get<boolean>('mail.secure'),
      ignoreTLS: this.config.get<boolean>('mail.ignoreTLS'),
      auth: {
        user: this.config.get('mail.user'),
        pass: this.config.get('mail.password'),
      },
    })
  }

  async sendInvitation(document: ESignDocument, request: ESignRequest) {
    const appBaseUrl = this.config.get<string>('APP_BASE_URL') ?? 'https://app.inventech.com.br'
    const signingUrl = `${appBaseUrl}/assinar/${request.token}`

    const html = this.buildInvitationEmail({
      signerName: request.signerName,
      documentTitle: document.title,
      signerRole: request.signerRole,
      customMessage: request.customMessage,
      signingUrl,
      expiresAt: request.tokenExpiresAt,
    })

    try {
      await this.transporter.sendMail({
        from: `"${this.config.get('mail.from.name')}" <${this.config.get('mail.from.address')}>`,
        to: request.signerEmail,
        subject: `Assinatura solicitada: ${document.title}`,
        html,
      })

      if (request.notificationChannels.includes('TELEGRAM' as any)) {
        await this.sendTelegram(request, signingUrl, document.title)
      }
    } catch (err) {
      this.logger.error(`Failed to send invitation to ${request.signerEmail}`, err)
    }
  }

  async sendCompletionEmails(document: ESignDocument & { requests?: ESignRequest[] }) {
    const settings = (document.settings as any) ?? {}
    const copyTo: string[] = settings.sendCopyTo ?? []

    const recipients = [
      ...(document.requests ?? []).map((r) => r.signerEmail),
      ...copyTo,
    ]

    const html = this.buildCompletionEmail({ documentTitle: document.title })

    await Promise.allSettled(
      recipients.map((email) =>
        this.transporter.sendMail({
          from: `"${this.config.get('mail.from.name')}" <${this.config.get('mail.from.address')}>`,
          to: email,
          subject: `Documento assinado: ${document.title}`,
          html,
          attachments: document.signedFileUrl
            ? [{ filename: `${document.title}.pdf`, path: document.signedFileUrl }]
            : [],
        }),
      ),
    )
  }

  async sendDeclineAlert(document: ESignDocument, request: ESignRequest, reason: string) {
    this.logger.warn(`Document ${document.id} declined by ${request.signerEmail}: ${reason}`)
  }

  async sendReminderEmail(document: ESignDocument, request: ESignRequest) {
    const appBaseUrl = this.config.get<string>('APP_BASE_URL') ?? 'https://app.inventech.com.br'
    const signingUrl = `${appBaseUrl}/assinar/${request.token}`

    const html = this.buildReminderEmail({
      signerName: request.signerName,
      documentTitle: document.title,
      signerRole: request.signerRole,
      signingUrl,
      expiresAt: request.tokenExpiresAt,
    })

    try {
      await this.transporter.sendMail({
        from: `"${this.config.get('mail.from.name')}" <${this.config.get('mail.from.address')}>`,
        to: request.signerEmail,
        subject: `Lembrete: Assinatura pendente - ${document.title}`,
        html,
      })
    } catch (err) {
      this.logger.error(`Failed to send reminder to ${request.signerEmail}`, err)
    }
  }

  private async sendTelegram(request: ESignRequest, signingUrl: string, documentTitle: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN')
    const chatId = (request as any).signerTelegramChatId
    if (!botToken || !chatId) return

    const axios = (await import('axios')).default
    const text = `📄 *Assinatura solicitada*\n\nDocumento: ${documentTitle}\nSua função: ${request.signerRole}\n\n[Clique aqui para assinar](${signingUrl})`

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }).catch((err) => this.logger.error('Telegram send failed', err))
  }

  private buildInvitationEmail(params: {
    signerName: string
    documentTitle: string
    signerRole: string
    customMessage?: string | null
    signingUrl: string
    expiresAt: Date
  }) {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#1E40AF">Assinatura Eletrônica Solicitada</h2>
        <p>Olá, <strong>${params.signerName}</strong></p>
        <p>Você foi solicitado a assinar o documento:</p>
        <p style="background:#F3F4F6;padding:12px;border-radius:8px;font-weight:bold">${params.documentTitle}</p>
        <p><strong>Sua função:</strong> ${params.signerRole}</p>
        ${params.customMessage ? `<p><em>${params.customMessage}</em></p>` : ''}
        <p>O link expira em: <strong>${params.expiresAt.toLocaleDateString('pt-BR')}</strong></p>
        <a href="${params.signingUrl}" style="display:inline-block;background:#1E40AF;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Assinar documento
        </a>
        <hr style="margin:24px 0;border-color:#E5E7EB"/>
        <p style="font-size:12px;color:#6B7280">
          Este documento foi assinado eletronicamente nos termos da Lei 14.063/2020 e MP 2.200-2/2001.
        </p>
      </div>
    `
  }

  private buildCompletionEmail(params: { documentTitle: string }) {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#16A34A">✅ Documento Assinado</h2>
        <p>O documento <strong>${params.documentTitle}</strong> foi assinado por todos os signatários.</p>
        <p>O PDF com as assinaturas e o certificado de autenticidade está em anexo.</p>
        <hr style="margin:24px 0;border-color:#E5E7EB"/>
        <p style="font-size:12px;color:#6B7280">
          Assinatura eletrônica em conformidade com a Lei 14.063/2020 e MP 2.200-2/2001.
        </p>
      </div>
    `
  }

  private buildReminderEmail(params: {
    signerName: string
    documentTitle: string
    signerRole: string
    signingUrl: string
    expiresAt: Date
  }) {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#D97706">⏰ Lembrete: Assinatura Pendente</h2>
        <p>Olá, <strong>${params.signerName}</strong></p>
        <p>Este é um lembrete de que você ainda não assinou o documento:</p>
        <p style="background:#F3F4F6;padding:12px;border-radius:8px;font-weight:bold">${params.documentTitle}</p>
        <p><strong>Sua função:</strong> ${params.signerRole}</p>
        <p>O link expira em: <strong>${params.expiresAt.toLocaleDateString('pt-BR')}</strong></p>
        <a href="${params.signingUrl}" style="display:inline-block;background:#D97706;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Assinar documento
        </a>
        <hr style="margin:24px 0;border-color:#E5E7EB"/>
        <p style="font-size:12px;color:#6B7280">
          Este documento foi assinado eletronicamente nos termos da Lei 14.063/2020 e MP 2.200-2/2001.
        </p>
      </div>
    `
  }
}
