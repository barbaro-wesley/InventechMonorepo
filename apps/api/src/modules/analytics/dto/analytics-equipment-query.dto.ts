import { IsOptional, IsDateString, IsUUID, IsInt, Min, Max, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class EquipmentOverviewQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() typeId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() costCenterId?: string
}

export class EquipmentRangeQueryDto extends EquipmentOverviewQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' }) @IsOptional() @IsDateString() startDate?: string
  @ApiPropertyOptional({ example: '2025-12-31' }) @IsOptional() @IsDateString() endDate?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class EquipmentCostsQueryDto extends EquipmentRangeQueryDto {
  @ApiPropertyOptional({ enum: ['equipment', 'type', 'location', 'costCenter'], default: 'equipment' })
  @IsOptional()
  @IsIn(['equipment', 'type', 'location', 'costCenter'])
  groupBy?: 'equipment' | 'type' | 'location' | 'costCenter'
}

export class EquipmentWarrantyQueryDto extends EquipmentOverviewQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 730,
    default: 90,
    description: 'Janela de vencimento a considerar, em dias a partir de hoje.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  daysAhead?: number

  @ApiPropertyOptional({
    enum: ['expiring', 'expired', 'all'],
    default: 'expiring',
    description:
      'expiring = vence dentro da janela; expired = garantia já vencida; ' +
      'all = ambos, vencidas primeiro.',
  })
  @IsOptional()
  @IsIn(['expiring', 'expired', 'all'])
  scope?: 'expiring' | 'expired' | 'all'

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number
}
