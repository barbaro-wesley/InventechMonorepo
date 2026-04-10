import { EmailPayload } from '../../../notifications/channels/email.channel'
import { compileMjml } from '../../../notifications/channels/templates/compile-mjml.util'

const CODE_EXPIRY_MINUTES = 10

export interface TwoFactorCodeData {
    userName: string
    subject: string
    code: string
    ipAddress?: string
}

export function buildTwoFactorCodeEmail(data: TwoFactorCodeData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: data.subject,
        html: compileMjml(`
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#374151" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f3f4f6">

    <mj-section background-color="#6366F1" border-radius="8px 8px 0 0" padding="20px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#ffffff">
          ${data.subject}
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text>
          Olá, <strong>${data.userName}</strong>!
        </mj-text>
        <mj-text>
          Seu código de verificação é:
        </mj-text>

        <mj-text align="center" font-size="36px" font-weight="bold" color="#6366F1" letter-spacing="12px" padding="24px 0">
          ${data.code}
        </mj-text>

        <mj-divider border-color="#e5e7eb" border-width="1px" padding="8px 0" />

        <mj-text color="#6b7280" font-size="13px">
          Este código expira em <strong>${CODE_EXPIRY_MINUTES} minutos</strong>. Não compartilhe com ninguém.
        </mj-text>

        ${data.ipAddress ? `
        <mj-text color="#9ca3af" font-size="12px">
          Solicitado do IP: ${data.ipAddress}
        </mj-text>` : ''}

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
