import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { Roles } from '../../common/decorators/roles.decorator'
import { AuditService } from './audit.service'
import { ListAuditLogsDto } from './dto/list-audit-logs.dto'

@ApiTags('Auditoria')
@ApiBearerAuth('JWT')
@Controller('audit')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get('logs')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Logs de alterações', description: 'Histórico paginado de criações, alterações e exclusões (campo, valor anterior e novo valor)' })
    list(@Query() query: ListAuditLogsDto) {
        return this.auditService.list(query)
    }

    @Get('entities')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Entidades auditadas', description: 'Lista as entidades que possuem registros de auditoria' })
    entities() {
        return this.auditService.entities()
    }

    @Get('logs/:entity/:entityId')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Histórico de um registro', description: 'Todas as alterações de um registro específico, ex.: quem deletou um equipamento' })
    history(@Param('entity') entity: string, @Param('entityId') entityId: string) {
        return this.auditService.history(entity, entityId)
    }
}
