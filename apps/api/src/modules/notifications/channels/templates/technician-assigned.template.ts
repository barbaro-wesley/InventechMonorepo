import { EmailPayload } from '../email.channel'
import { compileMjml } from './compile-mjml.util'

export interface TechnicianAssignedData {
    technicianName: string
    osNumber: number
    osTitle: string
    clientName: string
    equipmentName: string
    priority: string
    scheduledFor?: string
}

export function buildTechnicianAssignedEmail(data: TechnicianAssignedData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: `📋 OS #${data.osNumber} atribuída a você — ${data.osTitle}`,
        html: compileMjml(`
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#374151" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f3f4f6">

    <mj-section background-color="#3B82F6" border-radius="8px 8px 0 0" padding="20px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#ffffff">
          OS atribuída a você
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-text>
          Olá, <strong>${data.technicianName}</strong>!
        </mj-text>
        <mj-text>
          A OS <strong>#${data.osNumber} — ${data.osTitle}</strong> foi atribuída a você.
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
          ${data.scheduledFor ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Agendada para</td>
            <td style="padding: 8px 0;"><strong>${data.scheduledFor}</strong></td>
          </tr>` : ''}
        </mj-table>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
