import { EmailPayload } from '../email.channel'
import { compileMjml } from './compile-mjml.util'

export interface OsCompletedData {
    osNumber: number
    osTitle: string
    resolution: string
    technicianNames: string[]
}

export function buildOsCompletedEmail(data: OsCompletedData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: `✅ OS #${data.osNumber} concluída — aguardando aprovação`,
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
          OS concluída — aguardando aprovação
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text>
          <strong>OS #${data.osNumber} — ${data.osTitle}</strong> foi concluída.
        </mj-text>

        <mj-divider border-color="#e5e7eb" border-width="1px" padding="8px 0" />

        <mj-table>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Resolução</td>
            <td style="padding: 8px 0;">${data.resolution}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Técnico(s)</td>
            <td style="padding: 8px 0;"><strong>${data.technicianNames.join(', ')}</strong></td>
          </tr>
        </mj-table>

        <mj-text color="#6b7280" padding-top="16px">
          Acesse o sistema para aprovar ou reprovar.
        </mj-text>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
