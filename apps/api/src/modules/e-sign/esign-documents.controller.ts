import {
  Body, Controller, Delete, Get, Param, Post, Query,
  Req, Res, UseGuards, NotFoundException,
} from '@nestjs/common'
import { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AddESignRequestDto, CreateESignDocumentDto, ListESignDocumentsDto } from './dto/esign.dto'
import { ESignDocumentsService } from './services/esign-documents.service'
import { ESignPdfService } from './services/esign-pdf.service'
import { ESignReminderService } from './services/esign-reminder.service'

@UseGuards(JwtAuthGuard)
@Controller('e-sign/documents')
export class ESignDocumentsController {
  constructor(
    private readonly service: ESignDocumentsService,
    private readonly pdf: ESignPdfService,
    private readonly reminderService: ESignReminderService,
  ) {}

  @Post()
  async create(@Body() dto: CreateESignDocumentDto, @Req() req: any) {
    const { companyId, id: userId } = req.user
    // fileUrl and fileBuffer would normally come from a multipart upload
    // For now we accept fileUrl in the body as part of settings
    const fileUrl = (dto as any).fileUrl ?? ''
    const fileBuffer = Buffer.from('')
    return this.service.create(dto, fileBuffer, companyId, userId, fileUrl)
  }

  @Get()
  async findAll(@Query() filters: ListESignDocumentsDto, @Req() req: any) {
    return this.service.findAll(req.user.companyId, filters)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.companyId)
  }

  @Post(':id/signers')
  async addSigner(@Param('id') id: string, @Body() dto: AddESignRequestDto, @Req() req: any) {
    return this.service.addSigner(id, dto, req.user.companyId)
  }

  @Post(':id/send')
  async send(@Param('id') id: string, @Req() req: any) {
    return this.service.send(id, req.user.companyId, req.user.id)
  }

  @Delete(':id')
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.service.cancel(id, req.user.companyId, req.user.id)
  }

  @Post(':id/reminder')
  async sendReminder(@Param('id') id: string, @Body() body: { requestId: string }, @Req() req: any) {
    return this.reminderService.sendManualReminder(id, body.requestId, req.user.companyId)
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const doc = await this.service.findOne(id, req.user.companyId)
    if (!doc.signedFileUrl) throw new NotFoundException('PDF assinado ainda não disponível')

    const buffer = await this.pdf['fetchPdfFromUrl'](doc.signedFileUrl)
    const filename = encodeURIComponent(`${doc.title}_assinado.pdf`)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    })
    res.send(buffer)
  }
}
