import { EmailPayload } from '../email.channel'
import { compileMjml } from './compile-mjml.util'

export interface UniversalTemplateData {
    subject: string
    headerColor: string
    headerTitle: string
    bodyHtml: string
    tableRows: Array<{ label: string; value: string }>
    buttonLabel?: string
    buttonUrl?: string
    footerNote?: string
}

export function buildUniversalEmail(data: UniversalTemplateData): Pick<EmailPayload, 'subject' | 'html'> {
    const tableRowsMjml = data.tableRows.map(({ label, value }) => `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 160px; vertical-align: top;">${label}</td>
            <td style="padding: 8px 0;"><strong>${value}</strong></td>
          </tr>`).join('')

    const tableSectionMjml = data.tableRows.length > 0 ? `
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="8px 0" />
        <mj-table>
          ${tableRowsMjml}
        </mj-table>` : ''

    const buttonMjml = data.buttonLabel && data.buttonUrl ? `
        <mj-button background-color="${data.headerColor}" color="#ffffff"
                   font-size="14px" font-weight="bold" border-radius="6px"
                   padding-top="20px" href="${data.buttonUrl}">
          ${data.buttonLabel}
        </mj-button>` : ''

    const footerMjml = data.footerNote ? `
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0 8px" />
        <mj-text color="#9ca3af" font-size="12px">
          ${data.footerNote}
        </mj-text>` : ''

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

    <mj-section background-color="${data.headerColor}" border-radius="8px 8px 0 0" padding="20px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#ffffff">
          ${data.headerTitle}
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="24px" border-radius="0 0 8px 8px">
      <mj-column>
        <mj-text>${data.bodyHtml}</mj-text>
        ${tableSectionMjml}
        ${buttonMjml}
        ${footerMjml}
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`),
    }
}
