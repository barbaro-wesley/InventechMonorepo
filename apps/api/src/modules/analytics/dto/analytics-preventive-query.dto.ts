import { IsOptional, IsDateString, IsUUID, IsInt, Min, Max } from 'class-validator'
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
