import { EmailPayload } from '../email.channel'
import { compileMjml } from './compile-mjml.util'

export interface UnassignedAlertData {
    osNumber: number
    osTitle: string
    clientName: string
    hoursWaiting: number
    groupName?: string
}

export function buildUnassignedAlertEmail(data: UnassignedAlertData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: `⚠️ OS #${data.osNumber} sem técnico há ${data.hoursWaiting}h — ${data.osTitle}`,
        html: compileMjml(`
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#374151" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f3f4f6">

    <mj-section background-color="#F97316" border-radius="8px 8px 0 0" padding="20px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#ffffff">
          ⚠️ OS sem técnico responsável
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text>
          A OS <strong>#${data.osNumber} — ${data.osTitle}</strong> está no painel há
          <strong>${data.hoursWaiting} hora(s)</strong> sem nenhum técnico ter assumido.
        </mj-text>

        <mj-divider border-color="#e5e7eb" border-width="1px" padding="8px 0" />

        <mj-table>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Cliente</td>
            <td style="padding: 8px 0;"><strong>${data.clientName}</strong></td>
          </tr>
          ${data.groupName ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Grupo</td>
            <td style="padding: 8px 0;"><strong>${data.groupName}</strong></td>
          </tr>` : ''}
        </mj-table>

        <mj-text color="#dc2626" font-weight="bold" padding-top="16px">
          Ação necessária: acesse o painel e assuma ou atribua esta OS a um técnico.
        </mj-text>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
