import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { v4 as uuidv4 } from 'uuid'
import { LaudoFieldDefinition } from '../dto/laudo.dto'
import { CompaniesService } from '../../companies/companies.service'

const LAUDO_BUCKET = 'laudos'

interface ReportTemplate {
  companyName: string
  document: string | null
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  headerTitle: string
  footerText: string
  email: string
  phone: string
  address: string
}

interface LaudoPdfData {
  number: number
  title: string
  companyId: string
  companyName: string
  companyDocument?: string | null
  clientName?: string | null
  technicianName?: string | null
  referenceType: string
  fields: LaudoFieldDefinition[]
  notes?: string | null
  createdAt: Date
  resolvedVariables?: Record<string, string> | null
}

@Injectable()
export class LaudoPdfService {
  private readonly logger = new Logger(LaudoPdfService.name)
  private minio: Minio.Client

  constructor(
    private readonly config: ConfigService,
    private readonly companiesService: CompaniesService,
  ) {
    this.minio = new Minio.Client({
      endPoint: this.config.get<string>('minio.endpoint', 'localhost'),
      port: this.config.get<number>('minio.port', 9000),
      useSSL: this.config.get<boolean>('minio.useSSL', false),
      accessKey: this.config.get<string>('minio.accessKey', ''),
      secretKey: this.config.get<string>('minio.secretKey', ''),
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Logo fetch
  // ─────────────────────────────────────────────────────────────
  private async fetchLogoBuffer(logoUrl: string | null): Promise<Buffer | null> {
    if (!logoUrl) return null
    try {
      const { default: https } = await import('https')
      const { default: http } = await import('http')
      return await new Promise<Buffer>((resolve, reject) => {
        const lib = logoUrl.startsWith('https') ? https : http
        lib.get(logoUrl, (res) => {
          if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }).on('error', reject)
      })
    } catch {
      return null
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Corporate header — identical to reports (Ficha de Vida)
  //
  //  ┌── accent bar (3pt, primaryColor) ───────────────────────┐
  //  │  [LOGO]  COMPANY NAME           ┌── report panel ─────┐ │
  //  │          CNPJ: …                │ TÍTULO               │ │
  //  │          Address…               │ subtítulo             │ │
  //  │                                  └─────────────────────┘ │
  //  └── separator ────────────────────────────────────────────┘
  // ─────────────────────────────────────────────────────────────
  private drawPdfHeader(
    doc: any,
    template: ReportTemplate,
    title: string,
    subtitle: string,
    logoBuffer: Buffer | null,
  ): number {
    const ML = 40
    const W = doc.page.width - 80
    const TOP = 18

    // Accent bar
    doc.rect(ML, TOP, W, 3).fill(template.primaryColor)

    const bodyTop = TOP + 13
    const BODY_H = 80
    const LOGO_SIZE = 62

    const INFO_W = Math.floor(W * 0.62)
    const PANEL_GAP = 14
    const panelX = ML + INFO_W + PANEL_GAP
    const panelW = W - INFO_W - PANEL_GAP

    // Logo
    let nameX = ML
    if (logoBuffer) {
      try {
        const ly = bodyTop + Math.floor((BODY_H - LOGO_SIZE) / 2)
        doc.image(logoBuffer, ML, ly, { fit: [LOGO_SIZE, LOGO_SIZE] })
        nameX = ML + LOGO_SIZE + 12
      } catch { /* unsupported format */ }
    }

    // Company identity
    const tW = INFO_W - (nameX - ML) - 8
    let ty = bodyTop + 10

    doc.fillColor('#0F172A').fontSize(15).font('Helvetica-Bold')
      .text(template.companyName, nameX, ty, { width: tW, lineBreak: false, ellipsis: true })
    ty += 20

    if (template.document) {
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
        .text(`CNPJ: ${template.document}`, nameX, ty, { width: tW, lineBreak: false })
      ty += 13
    }

    if (template.address) {
      const lines = template.address.split(' · ')
      const line1 = lines.slice(0, 2).join(' · ')
      const line2 = lines.slice(2).join(' · ')
      doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
        .text(line1, nameX, ty, { width: tW, lineBreak: false, ellipsis: !line2 })
      if (line2) {
        ty += 11
        doc.text(line2, nameX, ty, { width: tW, lineBreak: false, ellipsis: true })
      }
    }

    // Report panel (right side)
    doc.rect(panelX, bodyTop, panelW, BODY_H).fill(template.primaryColor)
    doc.rect(panelX, bodyTop, 3, BODY_H).fill(template.secondaryColor)

    const pTextX = panelX + 14
    const pTextW = panelW - 20
    doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
      .text(title.toUpperCase(), pTextX, bodyTop + 14, { width: pTextW, lineBreak: true })

    const subParts = subtitle.split(/[·]/).map((s) => s.trim()).filter(Boolean)
    let sy = bodyTop + 14 + 18
    subParts.forEach((part) => {
      if (sy < bodyTop + BODY_H - 8) {
        doc.fillColor('#CBD5E1').fontSize(7.5).font('Helvetica')
          .text(part, pTextX, sy, { width: pTextW, lineBreak: false })
        sy += 11
      }
    })

    // Separator
    const endY = bodyTop + BODY_H + 10
    doc.rect(ML, endY, W, 0.75).fill('#CBD5E1')

    return endY + 8
  }

  // ─────────────────────────────────────────────────────────────
  // Footer — company + page number
  // ─────────────────────────────────────────────────────────────
  private drawPdfFooter(doc: any, template: ReportTemplate, y: number, currentPage: number, totalPages: number): void {
    const ML = 40
    const W = doc.page.width - 80
    doc.rect(ML, y, W, 0.5).fill('#E2E8F0')
    const parts = [template.companyName, template.footerText].filter(Boolean).join('  ·  ')
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
      .text(parts, ML, y + 5, { width: W / 2, lineBreak: false, ellipsis: true })

    const now = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    doc.text(`Emitido em ${now}  ·  Página ${currentPage} de ${totalPages}`, ML, y + 5, {
      width: W - 4, align: 'right', lineBreak: false,
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Section heading — blue text + colored underline
  // ─────────────────────────────────────────────────────────────
  private drawSectionTitle(doc: any, title: string, x: number, y: number, w: number, primary: string, secondary: string): number {
    doc.fillColor(primary).fontSize(12).font('Helvetica-Bold').text(title, x, y)
    const lineY = y + 15
    doc.rect(x, lineY, w, 1).fill(secondary)
    return lineY + 8
  }

  // ─────────────────────────────────────────────────────────────
  // Ensure we have enough vertical space; if not, add page + header
  // ─────────────────────────────────────────────────────────────
  private ensureSpace(
    doc: any, y: number, needed: number,
    template: ReportTemplate, title: string, subtitle: string, logoBuffer: Buffer | null,
  ): number {
    if (y + needed > doc.page.height - 60) {
      doc.addPage()
      return this.drawPdfHeader(doc, template, title, subtitle, logoBuffer) + 4
    }
    return y
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN — Generate laudo PDF
  // ─────────────────────────────────────────────────────────────
  async generate(data: LaudoPdfData): Promise<Buffer> {
    const template = await this.companiesService.getReportTemplate(data.companyId)
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)
    const PDFDocument = (await import('pdfkit')).default

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
      const buffers: Buffer[] = []
      doc.on('data', (chunk: Buffer) => buffers.push(chunk))

      const ML = 40
      const blue = template.primaryColor || '#1E40AF'
      const secondary = template.secondaryColor || '#DBEAFE'
      const textDark = '#1F2937'
      const textMuted = '#6B7280'
      const borderColor = '#E2E8F0'
      const W = doc.page.width - 80

      const dateStr = data.createdAt.toLocaleDateString('pt-BR')
      const laudoNum = String(data.number).padStart(4, '0')
      const subtitle = `Laudo Nº ${laudoNum}  ·  ${this.labelReferenceType(data.referenceType)}  ·  Emissão: ${dateStr}`

      // ── 1. Header ──
      let y = this.drawPdfHeader(doc, template, data.title, subtitle, logoBuffer)

      // ── 2. Dados do Laudo (grid, like Ficha de Vida) ──
      y = this.drawSectionTitle(doc, 'Informações do Laudo', ML, y + 4, W, blue, secondary)

      const infoFields: [string, string][] = [
        ['Laudo Nº:', laudoNum],
        ['Emissão:', dateStr],
        ['Empresa:', data.companyName + (data.companyDocument ? ` — ${data.companyDocument}` : '')],
        ['Referência:', this.labelReferenceType(data.referenceType)],
      ]
      if (data.clientName) infoFields.push(['Cliente:', data.clientName])
      if (data.technicianName) infoFields.push(['Técnico:', data.technicianName])

      const LABEL_W = 90
      const colW = W / 2
      let col = 0

      doc.fontSize(8.5)
      for (const [label, value] of infoFields) {
        const cx = ML + col * colW
        doc.fillColor(textMuted).font('Helvetica-Bold').text(label, cx, y, { width: LABEL_W })
        doc.fillColor(textDark).font('Helvetica').text(value, cx + LABEL_W, y, { width: colW - LABEL_W - 4, ellipsis: true })
        col++
        if (col > 1) { col = 0; y += 16 }
      }
      if (col !== 0) y += 16
      y += 6

      // ── 3. Fields from template ──
      const fields = data.fields ?? []
      if (fields.length > 0) {
        y = this.ensureSpace(doc, y, 30, template, data.title, subtitle, logoBuffer)
        y = this.drawSectionTitle(doc, 'Dados do Laudo', ML, y, W, blue, secondary)

        for (const field of fields) {
          // ─ HEADING ─
          if (field.type === 'HEADING') {
            y = this.ensureSpace(doc, y, 30, template, data.title, subtitle, logoBuffer)
            y = this.drawSectionTitle(doc, field.label, ML, y + 4, W, blue, secondary)
            continue
          }

          // ─ DIVIDER ─
          if (field.type === 'DIVIDER') {
            y = this.ensureSpace(doc, y, 12, template, data.title, subtitle, logoBuffer)
            doc.moveTo(ML, y + 4).lineTo(ML + W, y + 4).strokeColor(borderColor).stroke()
            y += 10
            continue
          }

          // ─ CHECKBOX ─
          if (field.type === 'CHECKBOX') {
            y = this.ensureSpace(doc, y, 18, template, data.title, subtitle, logoBuffer)
            const checked = field.value === true || field.value === 'true'
            const icon = checked ? '☑' : '☐'
            doc.fontSize(9).fillColor(textDark).font('Helvetica')
              .text(`${icon}  ${field.label}`, ML, y, { width: W })
            y += 14
            continue
          }

          // ─ TABLE ─
          if (field.type === 'TABLE') {
            const columns = field.tableColumns ?? [{ key: 'item', label: 'Item' }, { key: 'value', label: 'Valor' }]
            const rows: Record<string, string>[] = Array.isArray(field.value) ? field.value : []
            const tableH = 20 + 18 + Math.max(rows.length, 1) * 18 + 4

            y = this.ensureSpace(doc, y, Math.min(tableH, 120), template, data.title, subtitle, logoBuffer)
            this.drawTable(doc, field, ML, y, W, blue, secondary, borderColor, textDark, textMuted, template, data.title, subtitle, logoBuffer)
            y = doc.y + 6
            continue
          }

          // ─ Regular field (SHORT_TEXT, LONG_TEXT, NUMBER, DATE, SELECT…) ─
          const value = this.formatFieldValue(field)
          const isLong = field.type === 'LONG_TEXT'

          // Estimate height needed
          doc.fontSize(9)
          const valH = isLong && value
            ? Math.min(doc.heightOfString(value, { width: W - 8 }), 80)
            : 14
          const fieldH = 14 + valH + 6

          y = this.ensureSpace(doc, y, fieldH, template, data.title, subtitle, logoBuffer)

          // Label
          doc.fontSize(8).fillColor(textMuted).font('Helvetica-Bold')
            .text(field.label + (field.required ? ' *' : ''), ML, y, { width: W })
          y += 12

          // Value row — subtle bg
          const boxH = valH + 6
          doc.rect(ML, y, W, boxH).fill('#F8FAFC')
          doc.rect(ML, y, W, boxH).strokeColor(borderColor).lineWidth(0.5).stroke()

          doc.fontSize(9).fillColor(value ? textDark : '#9CA3AF').font('Helvetica')
            .text(value || '—', ML + 6, y + 3, {
              width: W - 12,
              height: boxH - 6,
              ellipsis: !isLong,
              lineBreak: isLong,
            })
          y += boxH + 4
        }
      }

      // ── 4. Observações ──
      if (data.notes && data.notes.trim()) {
        doc.fontSize(9)
        const notesH = doc.heightOfString(data.notes, { width: W })
        y = this.ensureSpace(doc, y, notesH + 30, template, data.title, subtitle, logoBuffer)

        y += 4
        y = this.drawSectionTitle(doc, 'Observações', ML, y, W, blue, secondary)

        doc.fontSize(9).fillColor(textDark).font('Helvetica')
          .text(data.notes, ML, y, { width: W })
        y = doc.y + 6
      }

      // ── 5. Footer on every page ──
      // IMPORTANT: Temporarily disable auto page-creation while rendering
      // footers. Writing text near the bottom margin via switchToPage causes
      // PDFKit to auto-create blank pages in a cascade.
      const totalPages = doc.bufferedPageRange().count
      const _origAddPage = doc.addPage
      doc.addPage = function () { return this }

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i)
        this.drawPdfFooter(doc, template, doc.page.height - 35, i + 1, totalPages)
      }

      doc.addPage = _origAddPage
      doc.end()
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Upload to MinIO
  // ─────────────────────────────────────────────────────────────
  async upload(buffer: Buffer, laudoId: string): Promise<string> {
    await this.ensureBucket()
    const key = `${laudoId}/${uuidv4()}.pdf`
    await this.minio.putObject(LAUDO_BUCKET, key, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    })
    const endpoint = this.config.get<string>('minio.endpoint', 'localhost')
    const port = this.config.get<number>('minio.port', 9000)
    const useSSL = this.config.get<boolean>('minio.useSSL', false)
    const proto = useSSL ? 'https' : 'http'
    return `${proto}://${endpoint}:${port}/${LAUDO_BUCKET}/${key}`
  }

  private async ensureBucket() {
    const exists = await this.minio.bucketExists(LAUDO_BUCKET)
    if (!exists) await this.minio.makeBucket(LAUDO_BUCKET, 'us-east-1')
  }

  // ─────────────────────────────────────────────────────────────
  // Table renderer — with page-break awareness
  // ─────────────────────────────────────────────────────────────
  private drawTable(
    doc: any,
    field: LaudoFieldDefinition,
    x: number,
    startY: number,
    width: number,
    primaryColor: string,
    secondaryColor: string,
    borderColor: string,
    textDark: string,
    textMuted: string,
    template: ReportTemplate,
    title: string,
    subtitle: string,
    logoBuffer: Buffer | null,
  ) {
    let y = startY
    const columns = field.tableColumns ?? [{ key: 'item', label: 'Item' }, { key: 'value', label: 'Valor' }]
    const rows: Record<string, string>[] = Array.isArray(field.value) ? field.value : []
    const colWidth = width / columns.length
    const rowH = 18

    // Table title
    doc.fontSize(8.5).fillColor(textMuted).font('Helvetica-Bold')
      .text(field.label, x, y, { width })
    y += 14

    // Draw header row
    const drawTableHeader = (localY: number) => {
      doc.rect(x, localY, width, 20).fill(primaryColor)
      columns.forEach((col, i) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
          .text(col.label, x + i * colWidth + 5, localY + 6, { width: colWidth - 10 })
      })
      return localY + 20
    }

    y = drawTableHeader(y)

    // Empty state
    if (rows.length === 0) {
      doc.rect(x, y, width, rowH).fill('#F9FAFB')
      doc.rect(x, y, width, rowH).strokeColor(borderColor).lineWidth(0.5).stroke()
      doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9)
        .text('Nenhum dado', x + 5, y + 4, { width: width - 10 })
      doc.y = y + rowH + 4
      return
    }

    // Data rows
    rows.forEach((row, ri) => {
      if (y + rowH > doc.page.height - 60) {
        doc.addPage()
        y = this.drawPdfHeader(doc, template, title, subtitle, logoBuffer) + 4
        y = drawTableHeader(y)
      }

      const bgColor = ri % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
      doc.rect(x, y, width, rowH).fill(bgColor)
      doc.rect(x, y, width, rowH).strokeColor(borderColor).lineWidth(0.5).stroke()

      columns.forEach((col, ci) => {
        doc.fillColor(textDark).font('Helvetica').fontSize(8)
          .text(String(row[col.key] ?? ''), x + ci * colWidth + 5, y + 4, {
            width: colWidth - 10, lineBreak: false, ellipsis: true,
          })
      })
      y += rowH
    })

    doc.y = y + 4
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  private formatFieldValue(field: LaudoFieldDefinition): string {
    const v = field.value
    if (v === undefined || v === null || v === '') return ''
    if (Array.isArray(v)) return v.join(', ')
    if (v instanceof Date) return v.toLocaleDateString('pt-BR')
    return String(v)
  }

  private labelReferenceType(type: string): string {
    const labels: Record<string, string> = {
      MAINTENANCE: 'Manutenção',
      SERVICE_ORDER: 'Ordem de Serviço',
      CUSTOM: 'Personalizado',
    }
    return labels[type] ?? type
  }
}
