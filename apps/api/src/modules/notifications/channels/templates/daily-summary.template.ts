import { EmailPayload } from '../email.channel'
import { compileMjml } from './compile-mjml.util'

export interface DailySummaryData {
    companyName: string
    date: string
    openCount: number
    inProgressCount: number
    completedPendingCount: number
    overdueCount: number
}

export function buildDailySummaryEmail(data: DailySummaryData): Pick<EmailPayload, 'subject' | 'html'> {
    return {
        subject: `📊 Resumo diário de OS — ${data.companyName} — ${data.date}`,
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
          Resumo diário — ${data.date}
        </mj-text>
        <mj-text color="#e0e7ff" font-size="13px">
          ${data.companyName}
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>

        <mj-table>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">🟡 OS no painel (sem técnico)</td>
            <td style="padding: 12px 8px; text-align: right;"><strong>${data.openCount}</strong></td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">🔵 OS em andamento</td>
            <td style="padding: 12px 8px; text-align: right;"><strong>${data.inProgressCount}</strong></td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">🟢 OS aguardando aprovação</td>
            <td style="padding: 12px 8px; text-align: right;"><strong>${data.completedPendingCount}</strong></td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; color: #dc2626;">🔴 OS com alerta (sem técnico)</td>
            <td style="padding: 12px 8px; text-align: right; color: #dc2626;"><strong>${data.overdueCount}</strong></td>
          </tr>
        </mj-table>

      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
