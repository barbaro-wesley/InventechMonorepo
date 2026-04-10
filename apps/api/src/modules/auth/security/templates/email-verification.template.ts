import { EmailPayload } from '../../../notifications/channels/email.channel'
import { compileMjml } from '../../../notifications/channels/templates/compile-mjml.util'

const TOKEN_EXPIRY_HOURS = 24

export interface EmailVerificationData {
    userName: string
    verificationUrl: string
}

export function buildEmailVerificationEmail(data: EmailVerificationData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: '✅ Confirme seu email — Sistema de Manutenção',
        html: compileMjml(`
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#374151" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f3f4f6">

    <mj-section background-color="#10B981" border-radius="8px 8px 0 0" padding="20px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#ffffff">
          Confirme seu email
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text>
          Olá, <strong>${data.userName}</strong>!
        </mj-text>
        <mj-text>
          Clique no botão abaixo para confirmar seu email e ativar sua conta.
        </mj-text>

        <mj-button background-color="#10B981" color="#ffffff" font-size="15px" font-weight="bold"
                   border-radius="8px" padding="14px 32px" href="${data.verificationUrl}">
          Confirmar email
        </mj-button>

        <mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0 8px" />

        <mj-text color="#6b7280" font-size="13px">
          O link expira em <strong>${TOKEN_EXPIRY_HOURS} horas</strong>.
        </mj-text>
        <mj-text color="#9ca3af" font-size="12px">
          Se você não criou uma conta, ignore este email.
        </mj-text>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
