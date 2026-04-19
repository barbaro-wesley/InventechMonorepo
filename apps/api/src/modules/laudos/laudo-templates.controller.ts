import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Permission } from '../../common/decorators/permission.decorator'
import { CreateLaudoTemplateDto, ListLaudoTemplatesDto, UpdateLaudoTemplateDto } from './dto/laudo.dto'
import { LaudoTemplatesService } from './services/laudo-templates.service'
import { AVAILABLE_VARIABLES } from './services/laudo-variables.service'

@UseGuards(JwtAuthGuard)
@Controller('laudo-templates')
export class LaudoTemplatesController {
  constructor(private readonly service: LaudoTemplatesService) {}

  @Get('variables')
  @Permission('laudo-template:read')
  getVariables() {
    return { variables: AVAILABLE_VARIABLES }
  }

  @Post(':id/clone')
  @Permission('laudo-template:create')
  clone(@Param('id') id: string, @Req() req: any) {
    return this.service.clone(id, req.user.companyId, req.user.sub)
  }

  @Post()
  @Permission('laudo-template:create')
  create(@Body() dto: CreateLaudoTemplateDto, @Req() req: any) {
    const fields = Array.isArray(req.body?.fields) ? req.body.fields : (dto.fields ?? [])
    return this.service.create({ ...dto, fields }, req.user.companyId, req.user.sub)
  }

  @Get()
  @Permission('laudo-template:list')
  findAll(@Query() filters: ListLaudoTemplatesDto, @Req() req: any) {
    return this.service.findAll(req.user.companyId, filters)
  }

  @Get(':id')
  @Permission('laudo-template:read')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.companyId)
  }

  @Patch(':id')
  @Permission('laudo-template:update')
  update(@Param('id') id: string, @Body() dto: UpdateLaudoTemplateDto, @Req() req: any) {
    const rawBody = req.body ?? {}
    const safeDto = { ...dto }
    if ('fields' in rawBody) safeDto.fields = Array.isArray(rawBody.fields) ? rawBody.fields : []
    return this.service.update(id, safeDto, req.user.companyId)
  }

  @Delete(':id')
  @Permission('laudo-template:delete')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.companyId)
  }
}
