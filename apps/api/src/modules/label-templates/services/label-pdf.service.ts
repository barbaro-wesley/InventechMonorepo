import { Injectable } from '@nestjs/common'
import { LabelReferenceType, LabelTemplate } from '@prisma/client'
import { CompaniesService } from '../../companies/companies.service'
import { LabelVariablesService, PreventiveOsRow } from './label-variables.service'
import {
  LabelLayout, LabelElement, LabelTextElement, LabelQrElement, LabelImageElement,
  LabelTableElement, LabelLineElement, LabelRectElement,
} from '../dto/label-template.dto'

// 1 mm = 72 / 25.4 pt
const MM = 2.834645669

@Injectable()
export class LabelPdfService {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly variablesService: LabelVariablesService,
  ) {}

  /**
   * Gera um PDF com uma página por entidade, desenhando o layout do template
   * com as variáveis resolvidas para cada `entityId`.
   */
  async render(
    companyId: string,
    template: Pick<LabelTemplate, 'referenceType' | 'layout'>,
    entityIds: string[],
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default
    const QRCodeLib = await import('qrcode')

    const layout = template.layout as unknown as LabelLayout
    const wPt = layout.width * MM
    const hPt = layout.height * MM

    const reportTemplate = await this.companiesService.getReportTemplate(companyId)
    const logoBuffer = await this.fetchLogoBuffer(reportTemplate.logoUrl)

    const doc = new PDFDocument({
      size: [wPt, hPt],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    })
    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))

    const hasTable = layout.elements.some((el) => el.type === 'table')

    for (const entityId of entityIds) {
      const vars = await this.variablesService.resolve(companyId, template.referenceType, entityId)
      const tableRows = hasTable
        ? await this.variablesService.resolvePreventiveOsRows(companyId, template.referenceType, entityId)
        : []
      await this.drawLabelPage(doc, QRCodeLib, layout, vars, logoBuffer, tableRows)
    }

    doc.end()
    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  private async drawLabelPage(
    doc: any,
    QRCodeLib: any,
    layout: LabelLayout,
    vars: Record<string, string>,
    logoBuffer: Buffer | null,
    tableRows: PreventiveOsRow[],
  ): Promise<void> {
    const wPt = layout.width * MM
    const hPt = layout.height * MM

    doc.addPage({ size: [wPt, hPt], margins: { top: 0, bottom: 0, left: 0, right: 0 } })

    // Fundo (se diferente de branco)
    if (layout.background && layout.background.toUpperCase() !== '#FFFFFF') {
      try { doc.rect(0, 0, wPt, hPt).fill(layout.background) } catch { /* cor inválida */ }
    }

    for (const el of layout.elements) {
      try {
        if (el.type === 'text') this.drawText(doc, el, vars)
        else if (el.type === 'qrcode') await this.drawQr(doc, QRCodeLib, el, vars)
        else if (el.type === 'image') this.drawImage(doc, el, logoBuffer)
        else if (el.type === 'table') this.drawTable(doc, el, tableRows)
        else if (el.type === 'rect') this.drawRect(doc, el)
        else if (el.type === 'line') this.drawLine(doc, el)
      } catch {
        // Um elemento malformado não deve derrubar a etiqueta inteira.
      }
    }
  }

  /** Desenha a tabela de OS preventivas dentro da caixa do elemento. */
  private drawTable(doc: any, el: LabelTableElement, rows: PreventiveOsRow[]): void {
    const columns = (el.columns ?? []).filter((c) => c.width > 0)
    if (columns.length === 0) return

    const boxX = el.x * MM
    const boxY = el.y * MM
    const boxW = el.width * MM
    const boxH = el.height * MM

    const fontSize = el.fontSize || 6
    const rowH = fontSize * 1.6
    const padX = 2
    const padY = Math.max(0, (rowH - fontSize) / 2 - 0.5)
    const borderColor = '#999999'
    const textColor = el.color || '#000000'
    const showHeader = el.showHeader !== false
    const showBorders = el.showBorders !== false

    // Larguras absolutas das colunas a partir dos pesos relativos.
    const totalWeight = columns.reduce((sum, c) => sum + c.width, 0)
    const colWidths = columns.map((c) => (boxW * c.width) / totalWeight)

    // Quantas linhas de dados cabem na caixa (respeitando maxRows).
    const headerH = showHeader ? rowH : 0
    const maxFit = Math.floor((boxH - headerH) / rowH)
    if (maxFit <= 0) return
    const limit = Math.min(maxFit, el.maxRows ?? rows.length)
    const visibleRows = rows.slice(0, limit)

    const drawRow = (cells: string[], y: number, bold: boolean) => {
      let x = boxX
      for (let i = 0; i < columns.length; i++) {
        const w = colWidths[i]
        if (showBorders) {
          doc.lineWidth(0.5).rect(x, y, w, rowH).stroke(borderColor)
        }
        const font = bold ? 'Helvetica-Bold' : 'Helvetica'
        doc.font(font).fontSize(fontSize).fillColor(textColor)
        doc.text(cells[i] ?? '', x + padX, y + padY, {
          width: Math.max(1, w - padX * 2),
          height: fontSize + 1,
          align: columns[i].key === 'number' ? 'center' : 'left',
          lineBreak: false,
          ellipsis: true,
        })
        x += w
      }
    }

    let y = boxY
    if (showHeader) {
      drawRow(columns.map((c) => c.label), y, el.headerBold !== false)
      y += rowH
    }
    for (const row of visibleRows) {
      drawRow(columns.map((c) => row[c.key] ?? ''), y, false)
      y += rowH
    }
  }

  /** Desenha um retângulo/moldura (preenchimento e/ou borda). */
  private drawRect(doc: any, el: LabelRectElement): void {
    const x = el.x * MM
    const y = el.y * MM
    const w = el.width * MM
    const h = el.height * MM
    const radius = Math.min((el.radius ?? 0) * MM, w / 2, h / 2)
    const borderWidth = el.borderWidth ?? 0.3
    const hasFill = typeof el.fill === 'string' && el.fill
    const hasBorder = borderWidth > 0 && !!el.borderColor

    // Sem preenchimento nem borda não há o que desenhar — evita deixar um path
    // pendente que "vazaria" para o próximo elemento pintado.
    if (!hasFill && !hasBorder) return

    if (radius > 0) doc.roundedRect(x, y, w, h, radius)
    else doc.rect(x, y, w, h)

    if (hasFill && hasBorder) {
      doc.lineWidth(borderWidth * MM).fillAndStroke(el.fill, el.borderColor)
    } else if (hasFill) {
      doc.fill(el.fill)
    } else if (hasBorder) {
      doc.lineWidth(borderWidth * MM).stroke(el.borderColor)
    }
  }

  /** Desenha uma linha divisória horizontal ou vertical dentro da caixa do elemento. */
  private drawLine(doc: any, el: LabelLineElement): void {
    const x = el.x * MM
    const y = el.y * MM
    const w = el.width * MM
    const h = el.height * MM
    const thickness = (el.thickness ?? 0.3) * MM
    const vertical = el.orientation === 'vertical'

    let x1: number, y1: number, x2: number, y2: number
    if (vertical) {
      // Linha vertical centralizada na largura da caixa.
      x1 = x2 = x + w / 2
      y1 = y
      y2 = y + h
    } else {
      // Linha horizontal centralizada na altura da caixa.
      x1 = x
      x2 = x + w
      y1 = y2 = y + h / 2
    }
    doc.lineWidth(thickness).moveTo(x1, y1).lineTo(x2, y2).stroke(el.color || '#000000')
  }

  private drawText(doc: any, el: LabelTextElement, vars: Record<string, string>): void {
    const text = this.variablesService.interpolate(el.content, vars)
    if (!text) return
    const bold = el.fontWeight === 'bold'
    const font = el.italic
      ? (bold ? 'Helvetica-BoldOblique' : 'Helvetica-Oblique')
      : (bold ? 'Helvetica-Bold' : 'Helvetica')
    doc.font(font).fontSize(el.fontSize).fillColor(el.color || '#000000')
    doc.text(text, el.x * MM, el.y * MM, {
      width: el.width * MM,
      height: el.height * MM,
      align: el.align ?? 'left',
      lineBreak: true,
      ellipsis: true,
    })
  }

  private async drawQr(
    doc: any,
    QRCodeLib: any,
    el: LabelQrElement,
    vars: Record<string, string>,
  ): Promise<void> {
    const value = this.variablesService.interpolate(el.value, vars)
    if (!value) return
    const png = await QRCodeLib.toBuffer(value, {
      type: 'png',
      width: 400,
      margin: 1,
      errorCorrectionLevel: el.errorCorrectionLevel ?? 'M',
    })
    // Mantém o QR quadrado, centralizado na caixa do elemento.
    const boxW = el.width * MM
    const boxH = el.height * MM
    const size = Math.min(boxW, boxH)
    const x = el.x * MM + (boxW - size) / 2
    const y = el.y * MM + (boxH - size) / 2
    doc.image(png, x, y, { width: size, height: size })
  }

  private drawImage(doc: any, el: LabelImageElement, logoBuffer: Buffer | null): void {
    if (!logoBuffer) return
    doc.image(logoBuffer, el.x * MM, el.y * MM, {
      fit: [el.width * MM, el.height * MM],
      align: 'center',
      valign: 'center',
    })
  }

  /** Baixa o logo da empresa como Buffer (PNG/JPG). Retorna null se falhar. */
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

  /** Tipo de referência ↔ label amigável (reservado para uso futuro/UX). */
  static referenceTypeLabel(rt: LabelReferenceType): string {
    return rt === LabelReferenceType.SERVICE_ORDER ? 'Ordem de Serviço' : 'Equipamento'
  }
}
