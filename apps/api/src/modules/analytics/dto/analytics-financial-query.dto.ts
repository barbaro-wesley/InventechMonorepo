import { IsOptional, IsDateString, IsUUID, IsInt, Min, Max, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class FinancialQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' }) @IsOptional() @IsDateString() startDate?: string
  @ApiPropertyOptional({ example: '2025-12-31' }) @IsOptional() @IsDateString() endDate?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string
}

export class FinancialTrendQueryDto extends FinancialQueryDto {
  @ApiPropertyOptional({ enum: ['month', 'quarter'], default: 'month' })
  @IsOptional()
  @IsIn(['month', 'quarter'])
  groupBy?: 'month' | 'quarter'
}

export class FinancialTcoQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() typeId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() costCenterId?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
