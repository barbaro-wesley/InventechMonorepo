import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { GhospService } from './ghosp.service'
import { ListPacientesDto, PacienteInternadoDto } from './dto/paciente-internado.dto'
import { Permission } from '../../common/decorators/permission.decorator'

@ApiTags('GHOSP')
@ApiBearerAuth('JWT')
@Controller('ghosp')
export class GhospController {
  constructor(private readonly ghospService: GhospService) {}

  // GET /ghosp/pacientes?page=1&limit=20
  @Get('pacientes')
  @ApiOperation({
    summary: 'Listar pacientes internados',
    description: 'Retorna registros paginados de sigh.v_controle_acesso do banco GHOSP.',
  })
  @ApiOkResponse({ description: '{ data: PacienteInternadoDto[], total, page, limit }' })
  @Permission('ghosp:list')
  listarPacientes(@Query() query: ListPacientesDto) {
    return this.ghospService.listarPacientesInternados(query.page ?? 1, query.limit ?? 20)
  }
}
