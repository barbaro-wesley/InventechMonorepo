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
