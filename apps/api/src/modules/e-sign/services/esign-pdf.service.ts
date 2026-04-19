import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PDFDocument, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib'
import * as Minio from 'minio'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

const ESIGN_BUCKET = 'e-sign-documents'

interface SignerData {
  name: string
  email: string
  cpf?: string | null
  role: string
  signedAt: Date
  ipAddress?: string | null
  geolocation?: { city?: string; state?: string; country?: string } | null
  signatureData?: string | null
  signatureHash?: string | null
}

interface CertificatePageData {
  documentTitle: string
  originalHash: string
  signedHash: string
  companyName: string
  companyCnpj?: string | null
  completedAt: Date
  verificationUrl: string
  qrCodeBase64: string
  signers: SignerData[]
}

@Injectable()
export class ESignPdfService {
  private readonly logger = new Logger(ESignPdfService.name)
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

  // ─── Garante que o bucket existe ────────────────────────────────────────────

  async ensureBucket() {
    const exists = await this.minio.bucketExists(ESIGN_BUCKET)
    if (!exists) await this.minio.makeBucket(ESIGN_BUCKET, 'us-east-1')
  }

  // ─── Download do PDF original do MinIO ──────────────────────────────────────

  async downloadPdf(key: string): Promise<Buffer> {
    const stream = await this.minio.getObject(ESIGN_BUCKET, key)
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (c: Buffer) => chunks.push(c))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  }

  // ─── Upload do PDF assinado para o MinIO ────────────────────────────────────

  async uploadSignedPdf(buffer: Buffer, documentId: string): Promise<string> {
    await this.ensureBucket()
    const key = `signed/${documentId}/${uuidv4()}.pdf`
    await this.minio.putObject(ESIGN_BUCKET, key, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    })
    const endpoint = this.config.get<string>('minio.endpoint', 'localhost')
    const port = this.config.get<number>('minio.port', 9000)
    const useSSL = this.config.get<boolean>('minio.useSSL', false)
    const proto = useSSL ? 'https' : 'http'
    return `${proto}://${endpoint}:${port}/${ESIGN_BUCKET}/${key}`
  }

  // ─── Upload do PDF original ──────────────────────────────────────────────────

  async uploadOriginalPdf(buffer: Buffer, documentId: string): Promise<{ url: string; hash: string; key: string }> {
    await this.ensureBucket()
    const key = `originals/${documentId}/${uuidv4()}.pdf`
    const hash = createHash('sha256').update(buffer).digest('hex')
    await this.minio.putObject(ESIGN_BUCKET, key, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    })
    const endpoint = this.config.get<string>('minio.endpoint', 'localhost')
    const port = this.config.get<number>('minio.port', 9000)
    const useSSL = this.config.get<boolean>('minio.useSSL', false)
    const proto = useSSL ? 'https' : 'http'
    return { url: `${proto}://${endpoint}:${port}/${ESIGN_BUCKET}/${key}`, hash, key }
  }

  // ─── Geração do PDF assinado final ──────────────────────────────────────────

  async generateSignedPdf(originalPdfUrl: string, certData: CertificatePageData): Promise<Buffer> {
    const originalBuffer = await this.fetchPdfFromUrl(originalPdfUrl)
    const pdfDoc = await PDFDocument.load(originalBuffer)

    await this.appendSignaturePage(pdfDoc, certData.signers)
    await this.appendCertificatePage(pdfDoc, certData)

    return Buffer.from(await pdfDoc.save())
  }

  // ─── Página de assinaturas ───────────────────────────────────────────────────

  private async appendSignaturePage(pdfDoc: PDFDocument, signers: SignerData[]) {
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const primaryR = 0.118
    const primaryG = 0.251
    const primaryB = 0.686

    // Título
    page.drawRectangle({ x: 40, y: height - 60, width: width - 80, height: 3, color: rgb(primaryR, primaryG, primaryB) })
    page.drawText('ASSINATURAS ELETRÔNICAS', {
      x: 40, y: height - 90, font: fontBold, size: 14, color: rgb(primaryR, primaryG, primaryB),
    })
    page.drawText(`${signers.length} signatário(s) · Documento assinado eletronicamente`, {
      x: 40, y: height - 108, font, size: 9, color: rgb(0.4, 0.4, 0.4),
    })

    let y = height - 140

    for (const signer of signers) {
      if (y < 120) break

      // Card background
      page.drawRectangle({ x: 40, y: y - 90, width: width - 80, height: 95, color: rgb(0.97, 0.98, 1), borderColor: rgb(0.87, 0.9, 0.96), borderWidth: 0.5 })

      // Barra lateral colorida
      page.drawRectangle({ x: 40, y: y - 90, width: 4, height: 95, color: rgb(primaryR, primaryG, primaryB) })

      // Assinatura como imagem (se disponível)
      if (signer.signatureData) {
        try {
          const base64Data = signer.signatureData.replace(/^data:image\/\w+;base64,/, '')
          const imgBuffer = Buffer.from(base64Data, 'base64')
          const img = await pdfDoc.embedPng(imgBuffer)
          const imgDims = img.scaleToFit(140, 55)
          page.drawImage(img, { x: 55, y: y - 75, width: imgDims.width, height: imgDims.height })
        } catch {
          page.drawText('[assinatura]', { x: 55, y: y - 50, font, size: 9, color: rgb(0.5, 0.5, 0.5) })
        }
      }

      // Informações do signatário
      const infoX = 210
      page.drawText(signer.name, { x: infoX, y: y - 18, font: fontBold, size: 11, color: rgb(0.06, 0.09, 0.16) })
      page.drawText(signer.role, { x: infoX, y: y - 32, font, size: 9, color: rgb(primaryR, primaryG, primaryB) })

      if (signer.cpf) {
        page.drawText(`CPF: ${signer.cpf}`, { x: infoX, y: y - 45, font, size: 8.5, color: rgb(0.35, 0.35, 0.35) })
      }

      const signedAtStr = signer.signedAt
        ? new Date(signer.signedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—'
      page.drawText(`Assinado em: ${signedAtStr}`, { x: infoX, y: y - 58, font, size: 8.5, color: rgb(0.35, 0.35, 0.35) })

      if (signer.ipAddress) {
        page.drawText(`IP: ${signer.ipAddress}`, { x: infoX, y: y - 70, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
      }

      if (signer.geolocation?.city) {
        const geoStr = [signer.geolocation.city, signer.geolocation.state, signer.geolocation.country].filter(Boolean).join(', ')
        page.drawText(geoStr, { x: infoX, y: y - 80, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
      }

      y -= 115
    }

    this.drawPageLegalFooter(page, font, width)
  }

  // ─── Página de certificado de autenticidade ──────────────────────────────────

  private async appendCertificatePage(pdfDoc: PDFDocument, data: CertificatePageData) {
    const page = pdfDoc.addPage([595.28, 841.89])
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const primaryR = 0.118
    const primaryG = 0.251
    const primaryB = 0.686

    // Borda superior
    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: rgb(primaryR, primaryG, primaryB) })

    // Título principal
    page.drawText('CERTIFICADO DE AUTENTICIDADE', {
      x: 40, y: height - 50, font: fontBold, size: 16, color: rgb(primaryR, primaryG, primaryB),
    })
    page.drawText('Assinatura Eletrônica · Lei 14.063/2020 · MP 2.200-2/2001', {
      x: 40, y: height - 68, font, size: 9, color: rgb(0.4, 0.4, 0.4),
    })

    // Separador
    page.drawRectangle({ x: 40, y: height - 78, width: width - 80, height: 0.75, color: rgb(0.8, 0.85, 0.9) })

    // Informações do documento
    let y = height - 105
    page.drawText('DADOS DO DOCUMENTO', { x: 40, y, font: fontBold, size: 10, color: rgb(0.25, 0.3, 0.45) })
    y -= 20

    const rows: [string, string][] = [
      ['Título', data.documentTitle],
      ['Empresa', data.companyName],
      ['CNPJ', data.companyCnpj ?? '—'],
      ['Concluído em', new Date(data.completedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ]

    for (const [label, value] of rows) {
      page.drawText(`${label}:`, { x: 40, y, font: fontBold, size: 9, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(value, { x: 160, y, font, size: 9, color: rgb(0.15, 0.15, 0.15) })
      y -= 16
    }

    // Hash section
    y -= 10
    page.drawText('INTEGRIDADE DO DOCUMENTO', { x: 40, y, font: fontBold, size: 10, color: rgb(0.25, 0.3, 0.45) })
    y -= 18

    page.drawText('Hash SHA-256 (original):', { x: 40, y, font: fontBold, size: 8.5, color: rgb(0.3, 0.3, 0.3) })
    y -= 13
    page.drawText(data.originalHash, { x: 40, y, font, size: 7.5, color: rgb(0.2, 0.2, 0.2) })
    y -= 16

    page.drawText('Hash SHA-256 (assinado):', { x: 40, y, font: fontBold, size: 8.5, color: rgb(0.3, 0.3, 0.3) })
    y -= 13
    page.drawText(data.signedHash, { x: 40, y, font, size: 7.5, color: rgb(0.2, 0.2, 0.2) })
    y -= 20

    // Signatários
    page.drawText('SIGNATÁRIOS', { x: 40, y, font: fontBold, size: 10, color: rgb(0.25, 0.3, 0.45) })
    y -= 4
    page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 0.5, color: rgb(0.85, 0.88, 0.93) })
    y -= 16

    for (const signer of data.signers) {
      if (y < 200) break
      page.drawText(`• ${signer.name}`, { x: 40, y, font: fontBold, size: 9, color: rgb(0.1, 0.1, 0.1) })
      page.drawText(signer.role, { x: 200, y, font, size: 9, color: rgb(primaryR, primaryG, primaryB) })
      y -= 13

      const signedAtStr = signer.signedAt
        ? new Date(signer.signedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : '—'
      const detail = [`Assinado: ${signedAtStr}`, signer.ipAddress ? `IP: ${signer.ipAddress}` : null].filter(Boolean).join('  ·  ')
      page.drawText(detail, { x: 52, y, font, size: 8, color: rgb(0.45, 0.45, 0.45) })
      y -= 16
    }

    // QR Code
    try {
      const qrBase64 = data.qrCodeBase64.replace(/^data:image\/\w+;base64,/, '')
      const qrBuffer = Buffer.from(qrBase64, 'base64')
      const qrImg = await pdfDoc.embedPng(qrBuffer)
      const qrSize = 110
      const qrX = width - 40 - qrSize
      const qrY = 80

      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize })
      page.drawText('Verificar autenticidade', { x: qrX - 8, y: qrY - 14, font, size: 7.5, color: rgb(0.4, 0.4, 0.4) })
      page.drawText(data.verificationUrl, { x: 40, y: qrY + 50, font, size: 6.5, color: rgb(0.4, 0.4, 0.4), maxWidth: qrX - 60 })
    } catch (e) {
      this.logger.warn('QR code embed failed', e)
    }

    // Rodapé legal
    this.drawPageLegalFooter(page, font, width)
  }

  // ─── Rodapé legal ────────────────────────────────────────────────────────────

  private drawPageLegalFooter(page: PDFPage, font: any, width: number) {
    const text = 'Este documento foi assinado eletronicamente nos termos da Lei 14.063/2020 e MP 2.200-2/2001.'
    page.drawRectangle({ x: 40, y: 30, width: width - 80, height: 0.5, color: rgb(0.82, 0.85, 0.9) })
    page.drawText(text, { x: 40, y: 18, font, size: 7, color: rgb(0.5, 0.5, 0.5), maxWidth: width - 80 })
  }

  // ─── Fetch PDF de uma URL externa/MinIO ──────────────────────────────────────

  private async fetchPdfFromUrl(url: string): Promise<Buffer> {
    const { default: https } = await import('https')
    const { default: http } = await import('http')
    return new Promise<Buffer>((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http
      lib.get(url, (res) => {
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })
  }
}
