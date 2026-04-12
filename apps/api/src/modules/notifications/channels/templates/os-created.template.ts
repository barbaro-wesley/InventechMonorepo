import { EmailPayload } from '../email.channel'
import { compileMjml } from './compile-mjml.util'

export interface OsCreatedData {
    osNumber: number
    osTitle: string
    clientName: string
    equipmentName: string
    priority: string
    groupName?: string
}

export function buildOsCreatedEmail(data: OsCreatedData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: `🔔 Nova OS #${data.osNumber} no painel — ${data.osTitle}`,
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
          Nova OS disponível no painel
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text font-size="15px">
          <strong>OS #${data.osNumber}</strong> — ${data.osTitle}
        </mj-text>

        <mj-divider border-color="#e5e7eb" border-width="1px" padding="8px 0" />

        <mj-table>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Cliente</td>
            <td style="padding: 8px 0;"><strong>${data.clientName}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Equipamento</td>
            <td style="padding: 8px 0;"><strong>${data.equipmentName}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Prioridade</td>
            <td style="padding: 8px 0;"><strong>${data.priority}</strong></td>
          </tr>
          ${data.groupName ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Grupo</td>
            <td style="padding: 8px 0;"><strong>${data.groupName}</strong></td>
          </tr>` : ''}
        </mj-table>

        <mj-text color="#6b7280" padding-top="16px">
          Acesse o sistema para assumir esta OS.
        </mj-text>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
