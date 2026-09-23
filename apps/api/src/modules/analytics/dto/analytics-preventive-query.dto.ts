import { IsOptional, IsDateString, IsUUID, IsInt, IsIn, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PreventiveBaseQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() equipmentId?: string
}

export class PreventiveAdherenceQueryDto extends PreventiveBaseQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' }) @IsOptional() @IsDateString() startDate?: string
  @ApiPropertyOptional({ example: '2025-12-31' }) @IsOptional() @IsDateString() endDate?: string
}

export class PreventiveTimelineQueryDto extends PreventiveAdherenceQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    description: 'Granularidade da série. Omitido = escolhida pelo tamanho do período.',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month'
}

export class PreventiveRankingQueryDto extends PreventiveAdherenceQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class PreventiveUpcomingQueryDto extends PreventiveBaseQueryDto {
  @ApiPropertyOptional({ description: 'Quantidade de dias à frente', minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  daysAhead?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
