import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { ESignCertificateService } from './services/esign-certificate.service'
import { ESignAuditService } from './services/esign-audit.service'
import { ESignEventType } from '@prisma/client'

// Public endpoint — verifies authenticity by certificate hash (via QR code)
@Controller('e-sign/verify')
export class ESignVerificationController {
  constructor(
    private readonly certificate: ESignCertificateService,
    private readonly audit: ESignAuditService,
  ) {}

  @Get(':hash')
  async verify(@Param('hash') hash: string) {
    const cert = await this.certificate.verify(hash)
    if (!cert) throw new NotFoundException('Certificado não encontrado ou hash inválido')

    await this.audit.log({
      documentId: cert.documentId,
      eventType: ESignEventType.HASH_VERIFIED,
      metadata: { certificateHash: hash },
    })

    return {
      valid: true,
      document: cert.documentSnapshot,
      signatures: cert.signaturesSnapshot,
      issuedAt: cert.issuedAt,
    }
  }
}
