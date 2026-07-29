import { Controller, Get, Put, Body, BadRequestException } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { SlaService } from './sla.service'
import { BatchUpdateSlaConfigDto } from './dto/update-sla-config.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@ApiTags('SLA')
@ApiBearerAuth('JWT')
@Controller('sla-configs')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER)
  @ApiOperation({ summary: 'Obtém as configurações de SLA por prioridade da empresa' })
  getSlaConfigs(@CurrentUser() currentUser: AuthenticatedUser) {
    if (!currentUser.companyId) {
      throw new BadRequestException('Empresa não identificada no usuário autenticado')
    }
    return this.slaService.getCompanySlaConfigs(currentUser.companyId)
  }

  @Put()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
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
}
