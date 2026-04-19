import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import { v4 as uuidv4 } from 'uuid'
import { LaudoFieldDefinition } from '../dto/laudo.dto'

const LAUDO_BUCKET = 'laudos'

interface LaudoPdfData {
  number: number
  title: string
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

  constructor(private readonly config: ConfigService) {
    this.minio = new Minio.Client({
      endPoint: this.config.get<string>('minio.endpoint', 'localhost'),
      port: this.config.get<number>('minio.port', 9000),
      useSSL: this.config.get<boolean>('minio.useSSL', false),
      accessKey: this.config.get<string>('minio.accessKey', ''),
      secretKey: this.config.get<string>('minio.secretKey', ''),
    })
  }

  async generate(data: LaudoPdfData): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
      const buffers: Buffer[] = []

      doc.on('data', (chunk: Buffer) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const primaryColor = '#1E40AF'
      const lightBg = '#F8FAFF'
      const textGray = '#374151'
      const mutedGray = '#6B7280'
      const borderColor = '#E5E7EB'
      const pageWidth = doc.page.width - 80  // margin 40 each side

      // ── Header ──────────────────────────────────────────────────────────────
      doc.rect(40, 40, pageWidth, 4).fill(primaryColor)
      doc.moveDown(0.5)

      doc.fontSize(18).fillColor(primaryColor).font('Helvetica-Bold')
        .text(data.title, 40, 55, { width: pageWidth })

      doc.fontSize(10).fillColor(mutedGray).font('Helvetica')
        .text(`Laudo Nº ${String(data.number).padStart(4, '0')}  ·  ${this.labelReferenceType(data.referenceType)}`, 40, doc.y + 4, { width: pageWidth })

      // ── Meta info box ────────────────────────────────────────────────────────
      const metaY = doc.y + 12
      doc.rect(40, metaY, pageWidth, 2).fill(borderColor)
      doc.moveDown(0.3)

      const metaStartY = metaY + 8
      doc.fontSize(8.5).fillColor(mutedGray).font('Helvetica')

      const metaItems: [string, string][] = [
        ['Empresa', data.companyName + (data.companyDocument ? ` — ${data.companyDocument}` : '')],
        ...(data.clientName ? [['Cliente', data.clientName] as [string, string]] : []),
        ...(data.technicianName ? [['Técnico', data.technicianName] as [string, string]] : []),
        ['Emitido em', data.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
      ]

      let metaY2 = metaStartY
      for (const [label, value] of metaItems) {
        doc.fillColor(mutedGray).text(`${label}:`, 40, metaY2, { continued: true, width: 80 })
        doc.fillColor(textGray).font('Helvetica-Bold').text(` ${value}`, { width: pageWidth - 80 })
        doc.font('Helvetica')
        metaY2 = doc.y
      }

      doc.moveTo(40, doc.y + 8).lineTo(40 + pageWidth, doc.y + 8).strokeColor(borderColor).stroke()
      doc.moveDown(1)

      // ── Fields ───────────────────────────────────────────────────────────────
      const fields = data.fields ?? []

      for (const field of fields) {
        if (doc.y > doc.page.height - 100) {
          doc.addPage()
          doc.y = 40
        }

        if (field.type === 'HEADING') {
          doc.fontSize(12).fillColor(primaryColor).font('Helvetica-Bold')
            .text(field.label, 40, doc.y + 8, { width: pageWidth })
          doc.rect(40, doc.y + 2, pageWidth, 1).fill(primaryColor)
          doc.moveDown(0.5)
          continue
        }

        if (field.type === 'DIVIDER') {
          doc.moveTo(40, doc.y + 6).lineTo(40 + pageWidth, doc.y + 6)
            .strokeColor(borderColor).stroke()
          doc.moveDown(0.8)
          continue
        }

        if (field.type === 'CHECKBOX') {
          const checked = field.value === true || field.value === 'true'
          doc.fontSize(9.5).fillColor(mutedGray).font('Helvetica')
            .text(`${checked ? '☑' : '☐'}  ${field.label}`, 40, doc.y + 4, { width: pageWidth })
          doc.moveDown(0.4)
          continue
        }

        if (field.type === 'TABLE') {
          this.drawTable(doc, field, 40, doc.y + 8, pageWidth, primaryColor, borderColor, textGray, mutedGray)
          doc.moveDown(0.5)
          continue
        }

        // Default label + value layout
        doc.fontSize(8.5).fillColor(mutedGray).font('Helvetica')
          .text(field.label + (field.required ? ' *' : ''), 40, doc.y + 6, { width: pageWidth })

        const value = this.formatFieldValue(field)
        doc.rect(40, doc.y + 2, pageWidth, field.type === 'LONG_TEXT' ? 60 : 22)
          .fill(lightBg)

        doc.fontSize(10).fillColor(value ? textGray : '#9CA3AF').font('Helvetica')
          .text(value || '—', 46, doc.y + 4, {
            width: pageWidth - 12,
            height: field.type === 'LONG_TEXT' ? 54 : 16,
            ellipsis: true,
          })
        doc.moveDown(0.6)
      }

      // ── Notes ────────────────────────────────────────────────────────────────
      if (data.notes) {
        if (doc.y > doc.page.height - 120) doc.addPage()

        doc.moveDown(0.5)
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold')
          .text('Observações', 40, doc.y, { width: pageWidth })
        doc.moveDown(0.3)
        doc.fontSize(9.5).fillColor(textGray).font('Helvetica')
          .text(data.notes, 40, doc.y, { width: pageWidth })
      }

      // ── Footer ───────────────────────────────────────────────────────────────
      const totalPages = (doc as any).bufferedPageRange().count
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i)
        const footerY = doc.page.height - 35
        doc.moveTo(40, footerY).lineTo(40 + pageWidth, footerY)
          .strokeColor(borderColor).stroke()
        doc.fontSize(7).fillColor(mutedGray).font('Helvetica')
          .text(
            'Este laudo foi gerado eletronicamente pelo sistema Inventech.',
            40, footerY + 6, { width: pageWidth - 60, align: 'left' },
          )
        doc.text(`${i + 1} / ${totalPages}`, 40, footerY + 6, { width: pageWidth, align: 'right' })
      }

      doc.end()
    })
  }

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

  private drawTable(
    doc: PDFKit.PDFDocument,
    field: LaudoFieldDefinition,
    x: number,
    y: number,
    width: number,
    primaryColor: string,
    borderColor: string,
    textGray: string,
    mutedGray: string,
  ) {
    const columns = field.tableColumns ?? [{ key: 'item', label: 'Item' }, { key: 'value', label: 'Valor' }]
    const rows: Record<string, string>[] = Array.isArray(field.value) ? field.value : []
    const colWidth = width / columns.length
    const rowHeight = 20
    const headerHeight = 22

    doc.fontSize(8.5).fillColor(mutedGray).font('Helvetica')
      .text(field.label, x, y - 4, { width })

    // Header
    doc.rect(x, y + 4, width, headerHeight).fill(primaryColor)
    columns.forEach((col, i) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
        .text(col.label, x + i * colWidth + 4, y + 10, { width: colWidth - 8 })
    })

    // Rows
    if (rows.length === 0) {
      doc.rect(x, y + 4 + headerHeight, width, rowHeight).fill('#F9FAFB')
      doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9)
        .text('—', x + 4, y + 4 + headerHeight + 5, { width })
      doc.rect(x, y + 4 + headerHeight, width, rowHeight).strokeColor(borderColor).stroke()
      doc.y = y + 4 + headerHeight + rowHeight + 4
      return
    }

    rows.forEach((row, ri) => {
      const rowY = y + 4 + headerHeight + ri * rowHeight
      if (ri % 2 === 0) doc.rect(x, rowY, width, rowHeight).fill('#F9FAFB')
      doc.rect(x, rowY, width, rowHeight).strokeColor(borderColor).stroke()
      columns.forEach((col, ci) => {
        doc.fillColor(textGray).font('Helvetica').fontSize(9)
          .text(String(row[col.key] ?? ''), x + ci * colWidth + 4, rowY + 5, { width: colWidth - 8 })
      })
    })

    doc.y = y + 4 + headerHeight + rows.length * rowHeight + 4
  }

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
