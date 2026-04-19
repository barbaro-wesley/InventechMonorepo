import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
  Req, Res, UseGuards, NotFoundException,
} from '@nestjs/common'
import { Response } from 'express'
import * as Minio from 'minio'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Permission } from '../../common/decorators/permission.decorator'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateLaudoDto, InitiateLaudoSignDto, ListLaudosDto, UpdateLaudoDto } from './dto/laudo.dto'
import { LaudosService } from './services/laudos.service'
import { LaudoPdfService } from './services/laudo-pdf.service'

@UseGuards(JwtAuthGuard)
@Controller('laudos')
export class LaudosController {
  private readonly minio: Minio.Client

  constructor(
    private readonly service: LaudosService,
    private readonly pdf: LaudoPdfService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.minio = new Minio.Client({
      endPoint: config.get<string>('minio.endpoint', 'localhost'),
      port: config.get<number>('minio.port', 9000),
      useSSL: config.get<boolean>('minio.useSSL', false),
      accessKey: config.get<string>('minio.accessKey', ''),
      secretKey: config.get<string>('minio.secretKey', ''),
    })
  }

  @Post('preview-fields')
  @Permission('laudo:create')
  previewFields(@Body() body: any, @Req() req: any) {
    return this.service.previewFields(
      body.templateId,
      req.user.companyId,
      {
        clientId: body.clientId,
        serviceOrderId: body.serviceOrderId,
        maintenanceId: body.maintenanceId,
        technicianId: body.technicianId,
      },
    )
  }

  @Post()
  @Permission('laudo:create')
  create(@Body() dto: CreateLaudoDto, @Req() req: any) {
    const fields = Array.isArray(req.body?.fields) ? req.body.fields : (dto.fields ?? [])
    return this.service.create({ ...dto, fields }, req.user.companyId, req.user.sub)
  }

  @Get()
  @Permission('laudo:list')
  findAll(@Query() filters: ListLaudosDto, @Req() req: any) {
    // Client users see only their own client's laudos
    const clientId = req.user.clientId ?? null
    return this.service.findAll(req.user.companyId, filters, clientId)
  }

  @Get(':id')
  @Permission('laudo:read')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.companyId, req.user.clientId ?? null)
  }

  @Patch(':id')
  @Permission('laudo:update')
  update(@Param('id') id: string, @Body() dto: UpdateLaudoDto, @Req() req: any) {
    const rawBody = req.body ?? {}
    const safeDto = { ...dto }
    if ('fields' in rawBody) safeDto.fields = Array.isArray(rawBody.fields) ? rawBody.fields : []
    return this.service.update(id, safeDto, req.user.companyId)
  }

  @Post(':id/submit')
  @Permission('laudo:update')
  submitForReview(@Param('id') id: string, @Req() req: any) {
    return this.service.submitForReview(id, req.user.companyId)
  }

  @Post(':id/approve')
  @Permission('laudo:approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approve(id, req.user.companyId, req.user.sub)
  }

  @Post(':id/cancel')
  @Permission('laudo:update')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.service.cancel(id, req.user.companyId)
  }

  @Post(':id/sign')
  @Permission('laudo:sign')
  initiateSign(@Param('id') id: string, @Body() dto: InitiateLaudoSignDto, @Req() req: any) {
    return this.service.initiateSign(id, req.user.companyId, req.user.sub, dto)
  }

  @Delete(':id')
  @Permission('laudo:delete')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.companyId)
  }

  @Get(':id/signed-pdf')
  @Permission('laudo:export-pdf')
  async downloadSignedPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const esignDoc = await this.prisma.eSignDocument.findFirst({
      where: { referenceType: 'LAUDO', referenceId: id, companyId: req.user.companyId },
      select: { signedFileUrl: true, title: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!esignDoc?.signedFileUrl) throw new NotFoundException('PDF assinado não disponível')

    const parsed = new URL(esignDoc.signedFileUrl)
    const parts = parsed.pathname.replace(/^\//, '').split('/')
    const bucket = parts[0]
    const key = parts.slice(1).join('/')

    const stream = await this.minio.getObject(bucket, key)
    const filename = encodeURIComponent(`Laudo_Assinado_${esignDoc.title}.pdf`)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` })
    stream.pipe(res)
  }

  @Get(':id/pdf')
  @Permission('laudo:export-pdf')
  async downloadPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const laudo = await this.service.findOne(id, req.user.companyId, req.user.clientId ?? null)

    const buffer = await this.pdf.generate({
      companyId: req.user.companyId,
      number: laudo.number,
      title: laudo.title,
      companyName: (laudo as any).company?.name ?? '',
      companyDocument: (laudo as any).company?.document ?? null,
      clientName: laudo.client?.name ?? null,
      technicianName: laudo.technician?.name ?? null,
      referenceType: laudo.referenceType,
      fields: laudo.fields as any,
      notes: laudo.notes,
      createdAt: laudo.createdAt,
      resolvedVariables: laudo.resolvedVariables as any,
    })

    // Persist PDF URL after first generation
    if (!laudo.pdfUrl) {
      const url = await this.pdf.upload(buffer, laudo.id)
      await this.service.savePdfUrl(laudo.id, url)
    }

    const filename = encodeURIComponent(`Laudo_${String(laudo.number).padStart(4, '0')}_${laudo.title}.pdf`)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    })
    res.send(buffer)
  }

  @Post(':id/pdf/regenerate')
  @Permission('laudo:export-pdf')
  async regeneratePdf(@Param('id') id: string, @Req() req: any) {
    const laudo = await this.service.findOne(id, req.user.companyId, req.user.clientId ?? null)

    const buffer = await this.pdf.generate({
      companyId: req.user.companyId,
      number: laudo.number,
      title: laudo.title,
      companyName: (laudo as any).company?.name ?? '',
      companyDocument: (laudo as any).company?.document ?? null,
      clientName: laudo.client?.name ?? null,
      technicianName: laudo.technician?.name ?? null,
      referenceType: laudo.referenceType,
      fields: laudo.fields as any,
      notes: laudo.notes,
      createdAt: laudo.createdAt,
      resolvedVariables: laudo.resolvedVariables as any,
    })

    const url = await this.pdf.upload(buffer, laudo.id)
    await this.service.savePdfUrl(laudo.id, url)
    return { pdfUrl: url }
  }
}
