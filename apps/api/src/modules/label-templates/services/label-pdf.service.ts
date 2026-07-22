import { Injectable } from '@nestjs/common'
import { LabelReferenceType, LabelTemplate } from '@prisma/client'
import { CompaniesService } from '../../companies/companies.service'
import { LabelVariablesService } from './label-variables.service'
import {
  LabelLayout, LabelElement, LabelTextElement, LabelQrElement, LabelImageElement,
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

    for (const entityId of entityIds) {
      const vars = await this.variablesService.resolve(companyId, template.referenceType, entityId)
      await this.drawLabelPage(doc, QRCodeLib, layout, vars, logoBuffer)
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
      } catch {
        // Um elemento malformado não deve derrubar a etiqueta inteira.
      }
    }
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
