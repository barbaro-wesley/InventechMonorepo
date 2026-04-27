import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { GhospService } from './ghosp.service'
import { PacienteInternadoDto } from './dto/paciente-internado.dto'
import { Permission } from '../../common/decorators/permission.decorator'

@ApiTags('GHOSP')
@ApiBearerAuth('JWT')
@Controller('ghosp')
export class GhospController {
  constructor(private readonly ghospService: GhospService) {}

  // GET /ghosp/pacientes
  @Get('pacientes')
  @ApiOperation({
    summary: 'Listar pacientes internados',
    description: 'Retorna todos os registros de sigh.v_controle_acesso do banco GHOSP.',
  })
  @ApiOkResponse({ type: PacienteInternadoDto, isArray: true })
  @Permission('ghosp:list')
  listarPacientes(): Promise<PacienteInternadoDto[]> {
    return this.ghospService.listarPacientesInternados()
  }
}
