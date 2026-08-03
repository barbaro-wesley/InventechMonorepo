import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, Res, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LabelReferenceType } from '@prisma/client'
import { LabelTemplatesService } from './services/label-templates.service'
import { LabelPdfService } from './services/label-pdf.service'
import { LabelVariablesService } from './services/label-variables.service'
import {
  CreateLabelTemplateDto, UpdateLabelTemplateDto, ListLabelTemplatesDto, RenderLabelsDto,
  RenderSheetDto, LabelSheet,
} from './dto/label-template.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@ApiTags('Label Templates')
@ApiBearerAuth('JWT')
@Controller('label-templates')
export class LabelTemplatesController {
  constructor(
    private readonly service: LabelTemplatesService,
    private readonly pdfService: LabelPdfService,
    private readonly variablesService: LabelVariablesService,
  ) {}

  @Get('variables')
  @ApiOperation({ summary: 'Variáveis disponíveis para um tipo de etiqueta' })
  @Permission('label-template:read')
  getVariables(@Query('referenceType') referenceType?: string) {
    const rt = (referenceType as LabelReferenceType) ?? LabelReferenceType.EQUIPMENT
    const type = Object.values(LabelReferenceType).includes(rt) ? rt : LabelReferenceType.EQUIPMENT
    return { variables: this.variablesService.getAvailableVariables(type) }
  }

  @Get()
  @ApiOperation({ summary: 'Listar templates de etiqueta' })
  @Permission('label-template:list')
  findAll(@Query() filters: ListLabelTemplatesDto, @CurrentUser() cu: AuthenticatedUser) {
    return this.service.findAll(cu.companyId!, filters)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter um template de etiqueta' })
  @Permission('label-template:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
    return this.service.findOne(id, cu.companyId!)
  }

  @Post()
  @ApiOperation({ summary: 'Criar template de etiqueta' })
  @Permission('label-template:create')
  create(@Body() dto: CreateLabelTemplateDto, @CurrentUser() cu: AuthenticatedUser) {
    return this.service.create(dto, cu.companyId!, cu.sub)
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clonar template de etiqueta' })
  @Permission('label-template:create')
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
    return this.service.clone(id, cu.companyId!, cu.sub)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar template de etiqueta' })
  @Permission('label-template:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabelTemplateDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, cu.companyId!)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir template de etiqueta' })
  @Permission('label-template:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
    return this.service.remove(id, cu.companyId!)
  }

  @Get(':id/render')
  @ApiOperation({ summary: 'Gerar PDF de uma etiqueta a partir do template' })
  @Permission('label-template:read')
  async render(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('entityId') entityId: string,
    @CurrentUser() cu: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const template = await this.service.findOne(id, cu.companyId!)
    const buffer = await this.pdfService.render(cu.companyId!, template, [entityId])
    this.sendPdf(res, buffer, 'etiqueta.pdf')
  }

  @Post(':id/render-batch')
  @ApiOperation({ summary: 'Gerar PDF de várias etiquetas a partir do template' })
  @Permission('label-template:read')
  @HttpCode(HttpStatus.OK)
  async renderBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenderLabelsDto,
    @CurrentUser() cu: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const template = await this.service.findOne(id, cu.companyId!)
    const buffer = await this.pdfService.render(cu.companyId!, template, dto.entityIds)
    this.sendPdf(res, buffer, 'etiquetas.pdf')
  }

  @Post(':id/render-sheet')
  @ApiOperation({ summary: 'Gerar PDF de uma folha (A4/A3/A5) com várias etiquetas' })
  @Permission('label-template:read')
  @HttpCode(HttpStatus.OK)
  async renderSheet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenderSheetDto,
    @CurrentUser() cu: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const template = await this.service.findOne(id, cu.companyId!)
    const buffer = await this.pdfService.renderSheet(cu.companyId!, template, {
      sheet: dto.sheet as Partial<LabelSheet> | undefined,
      cells: dto.cells,
      entityIds: dto.entityIds,
    })
    this.sendPdf(res, buffer, 'etiquetas-folha.pdf')
  }

  private sendPdf(res: Response, buffer: Buffer, filename: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    })
    res.end(buffer)
  }
}
