import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiOperation } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { ScansService } from './scans.service'
import { ListScansDto, ScanWebhookDto, UpdateScanMetadataDto } from './dto/scan.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import { Public } from '../../common/decorators/public.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('scans')
export class ScansController {
  constructor(
    private readonly scansService: ScansService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Permission('scan:list')
  @ApiOperation({ summary: 'Listar scans da empresa com busca' })
  findAll(
    @Query() filters: ListScansDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.findAll(cu, filters)
  }

  @Get(':id')
  @Permission('scan:read')
  @ApiOperation({ summary: 'Buscar scan por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.findOne(id, cu)
  }

  @Get(':id/download')
  @Permission('scan:download')
  @ApiOperation({ summary: 'Download do arquivo de scan via stream' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType, sizeBytes } = await this.scansService.download(id, cu)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)
    res.setHeader('Content-Length', sizeBytes)
    res.setHeader('Cache-Control', 'no-store')
    stream.pipe(res)
  }

  @Patch(':id/metadata')
  @Permission('scan:update')
  @ApiOperation({ summary: 'Atualizar metadados do paciente manualmente' })
  updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScanMetadataDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.updateMetadata(id, dto, cu)
  }

  @Delete(':id')
  @Permission('scan:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover scan (arquivo + registro)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.remove(id, cu)
  }

  // ─── Webhook interno — chamado pelo OCR worker após processar um scan ────────
  // Protegido por shared secret (não requer JWT de usuário)
  @Post('webhook/processed')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Interno] Notificação de scan processado pelo OCR worker' })
  async webhookProcessed(
    @Headers('x-webhook-secret') secret: string,
    @Body() body: ScanWebhookDto,
  ) {
    const expected = this.config.get<string>('app.scanWebhookSecret')
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Webhook secret inválido')
    }
    await this.scansService.notifyProcessed(body.scanId, body.companyId)
    return { ok: true }
  }
}
