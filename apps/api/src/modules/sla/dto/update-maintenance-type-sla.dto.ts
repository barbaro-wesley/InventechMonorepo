import { Type } from 'class-transformer'
import { IsArray, IsEnum, IsInt, IsOptional, Min, Max, ValidateNested } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MaintenanceType, ServiceOrderPriority } from '@prisma/client'

/**
 * Tipos aceitos na configuração de SLA por tipo de manutenção.
 * CORRECTIVE fica de fora: seu SLA é definido por prioridade em /sla-configs.
 */
const CONFIGURABLE_MAINTENANCE_TYPES = [
  MaintenanceType.PREVENTIVE,
  MaintenanceType.INITIAL_ACCEPTANCE,
  MaintenanceType.EXTERNAL_SERVICE,
  MaintenanceType.TECHNOVIGILANCE,
  MaintenanceType.TRAINING,
  MaintenanceType.IMPROPER_USE,
  MaintenanceType.DEACTIVATION,
] as const

// 8760h = 365 dias.
const MAX_SLA_HOURS = 8760

export class UpdateMaintenanceTypeSlaDto {
  @ApiProperty({
    description: 'Tipo de manutenção. Corretiva não é aceita — use /sla-configs (SLA por prioridade).',
    enum: CONFIGURABLE_MAINTENANCE_TYPES,
    example: MaintenanceType.INITIAL_ACCEPTANCE,
  })
  @IsEnum(MaintenanceType)
  maintenanceType: MaintenanceType

  @ApiProperty({
    description: 'Prioridade do chamado à qual estes prazos se aplicam.',
    enum: ServiceOrderPriority,
    example: ServiceOrderPriority.MEDIUM,
  })
  @IsEnum(ServiceOrderPriority)
  priority: ServiceOrderPriority

  @ApiPropertyOptional({
    description: 'Prazo de primeiro atendimento (TPA) em horas. Nulo = sem prazo de TPA.',
    example: 24,
    minimum: 0,
    maximum: MAX_SLA_HOURS,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SLA_HOURS)
  maxResponseHours?: number | null

  @ApiProperty({
    description: 'Prazo de conclusão/resolução em horas. Ex.: 72 = 3 dias, 720 = 30 dias.',
    example: 72,
    minimum: 1,
    maximum: MAX_SLA_HOURS,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_SLA_HOURS)
  maxResolutionHours: number
}

export class BatchUpdateMaintenanceTypeSlaDto {
  @ApiProperty({ type: [UpdateMaintenanceTypeSlaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMaintenanceTypeSlaDto)
  configs: UpdateMaintenanceTypeSlaDto[]
}
