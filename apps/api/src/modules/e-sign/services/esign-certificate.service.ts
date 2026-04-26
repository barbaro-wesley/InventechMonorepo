import { Injectable } from '@nestjs/common'
import { createHash } from 'crypto'
import * as QRCode from 'qrcode'
import { PrismaService } from '../../../prisma/prisma.service'
import { ESignPdfService } from './esign-pdf.service'

@Injectable()
export class ESignCertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: ESignPdfService,
  ) {}

  async issue(documentId: string, appBaseUrl: string): Promise<void> {
    const document = await this.prisma.eSignDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: {
        requests: {
          where: { status: 'SIGNED' },
          include: {
            events: {
              where: { eventType: 'DOCUMENT_SIGNED' },
              orderBy: { occurredAt: 'desc' },
              take: 1,
            },
          },
        },
        company: true,
      },
    })

    const signaturesSnapshot = document.requests.map((r) => ({
      name: r.signerName,
      email: r.signerEmail,
      cpf: r.signerCpf,
      role: r.signerRole,
      signingOrder: r.signingOrder,
      signedAt: r.signedAt,
      ipAddress: r.events[0]?.ipAddress ?? null,
      geolocation: (r.events[0]?.geolocation as object) ?? null,
      signatureData: r.signatureData,
      signatureHash: r.signatureData
        ? createHash('sha256').update(r.signatureData).digest('hex')
        : null,
    }))

    const hashInput = [
      document.originalHash,
      ...signaturesSnapshot.map((s) => `${s.email}:${s.signedAt?.toISOString()}`),
    ].join('|')

    const certificateHash = createHash('sha256').update(hashInput).digest('hex')
    const verificationUrl = `${appBaseUrl}/e-sign/verify/${certificateHash}`

    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, { type: 'png', width: 200, margin: 1 })
    const qrCodeBase64 = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`

    // Gera o PDF assinado com página de assinaturas + certificado
    const signedPdfBuffer = await this.pdf.generateSignedPdf(document.originalFileUrl, {
      documentTitle: document.title,
      originalHash: document.originalHash,
      signedHash: certificateHash,
      companyName: document.company.name,
      companyCnpj: document.company.document,
      completedAt: document.completedAt ?? new Date(),
      verificationUrl,
      qrCodeBase64,
      signers: signaturesSnapshot.map((s) => ({
        name: s.name,
        email: s.email,
        cpf: s.cpf,
        role: s.role,
        signedAt: s.signedAt!,
        ipAddress: s.ipAddress,
        geolocation: s.geolocation as any,
        signatureData: s.signatureData,
        signatureHash: s.signatureHash,
      })),
    })

    const signedFileUrl = await this.pdf.uploadSignedPdf(signedPdfBuffer, documentId)
    const signedHash = createHash('sha256').update(signedPdfBuffer).digest('hex')

    await this.prisma.eSignDocument.update({
      where: { id: documentId },
      data: { signedFileUrl, signedHash },
    })

    const documentSnapshot = {
      title: document.title,
      referenceType: document.referenceType,
      originalHash: document.originalHash,
      signedHash,
      createdAt: document.createdAt,
      completedAt: document.completedAt,
      companyName: document.company.name,
      companyCnpj: document.company.document,
    }

    await this.prisma.eSignCertificate.create({
      data: {
        documentId,
        certificateHash,
        verificationUrl,
        qrCodeImageUrl: qrCodeBase64,
        signaturesSnapshot,
        documentSnapshot,
      },
    })
  }

  async verify(hash: string) {
    return this.prisma.eSignCertificate.findUnique({
      where: { certificateHash: hash },
    })
  }
}
