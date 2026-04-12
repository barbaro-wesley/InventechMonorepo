import { EmailPayload } from '../../../notifications/channels/email.channel'
import { compileMjml } from '../../../notifications/channels/templates/compile-mjml.util'

const RESET_TOKEN_EXPIRY_HOURS = 1

export interface PasswordResetData {
    userName: string
    resetUrl: string
    ipAddress?: string
}

export function buildPasswordResetEmail(data: PasswordResetData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: '🔑 Redefinição de senha — Sistema de Manutenção',
        html: compileMjml(`
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#374151" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f3f4f6">

    <mj-section background-color="#F59E0B" border-radius="8px 8px 0 0" padding="20px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#ffffff">
          Redefinir senha
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text>
          Olá, <strong>${data.userName}</strong>!
        </mj-text>
        <mj-text>
          Recebemos uma solicitação para redefinir a senha da sua conta.
        </mj-text>

        <mj-button background-color="#F59E0B" color="#ffffff" font-size="15px" font-weight="bold"
                   border-radius="8px" padding="14px 32px" href="${data.resetUrl}">
          Redefinir senha
        </mj-button>

        <mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0 8px" />

        <mj-text color="#6b7280" font-size="13px">
          O link expira em <strong>${RESET_TOKEN_EXPIRY_HOURS} hora(s)</strong>.
        </mj-text>
        ${data.ipAddress ? `
        <mj-text color="#9ca3af" font-size="12px">
          Solicitado do IP: ${data.ipAddress}
        </mj-text>` : ''}
        <mj-text color="#9ca3af" font-size="12px">
          Se você não solicitou a redefinição, ignore este email. Sua senha permanece a mesma.
        </mj-text>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
