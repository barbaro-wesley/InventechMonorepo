import { Controller, Get, Put, Body, BadRequestException } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SlaService } from './sla.service'
import { BatchUpdateSlaConfigDto } from './dto/update-sla-config.dto'
import { UpdatePreventiveSlaDto } from './dto/update-preventive-sla.dto'
import { BatchUpdateMaintenanceTypeSlaDto } from './dto/update-maintenance-type-sla.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@ApiTags('SLA')
@ApiBearerAuth('JWT')
@Controller('sla-configs')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get()
  @Permission('sla:read')
  @ApiOperation({ summary: 'Obtém as configurações de SLA por prioridade da empresa' })
  getSlaConfigs(@CurrentUser() currentUser: AuthenticatedUser) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    return this.slaService.getCompanySlaConfigs(currentUser.companyId)
  }

  @Put()
  @Permission('sla:update')
  @ApiOperation({ summary: 'Atualiza as configurações de SLA por prioridade da empresa' })
  updateSlaConfigs(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: BatchUpdateSlaConfigDto,
  ) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    return this.slaService.updateCompanySlaConfigs(currentUser.companyId, dto)
  }

  @Get('maintenance-types')
  @Permission('sla:read')
  @ApiOperation({
    summary: 'Obtém os prazos de SLA (em horas) por tipo de manutenção',
    description: 'Não inclui corretiva, cujo SLA é definido por prioridade em GET /sla-configs.',
  })
  getMaintenanceTypeSlaConfigs(@CurrentUser() currentUser: AuthenticatedUser) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    return this.slaService.getMaintenanceTypeSlaConfigs(currentUser.companyId)
  }

  @Put('maintenance-types')
  @Permission('sla:update')
  @ApiOperation({ summary: 'Atualiza os prazos de SLA (em horas) por tipo de manutenção' })
  updateMaintenanceTypeSlaConfigs(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: BatchUpdateMaintenanceTypeSlaDto,
  ) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    return this.slaService.updateMaintenanceTypeSlaConfigs(currentUser.companyId, dto)
  }

  @Get('preventive')
  @Permission('sla:read')
  @ApiOperation({
    summary: 'Obtém o prazo de execução (SLA) das preventivas em dias',
    deprecated: true,
    description: 'Mantido por compatibilidade. Use GET /sla-configs/maintenance-types.',
  })
  async getPreventiveSla(@CurrentUser() currentUser: AuthenticatedUser) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    const executionDays = await this.slaService.getPreventiveSlaDays(currentUser.companyId)
    return { executionDays }
  }

  @Put('preventive')
  @Permission('sla:update')
  @ApiOperation({
    summary: 'Atualiza o prazo de execução (SLA) das preventivas em dias',
    deprecated: true,
    description: 'Mantido por compatibilidade. Use PUT /sla-configs/maintenance-types.',
  })
  updatePreventiveSla(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdatePreventiveSlaDto,
  ) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    return this.slaService.updatePreventiveSlaDays(currentUser.companyId, dto.executionDays)
  }
}
