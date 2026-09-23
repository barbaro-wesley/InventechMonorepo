import { IsOptional, IsDateString, IsUUID, IsIn } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ProvidersQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' }) @IsOptional() @IsDateString() startDate?: string
  @ApiPropertyOptional({ example: '2025-12-31' }) @IsOptional() @IsDateString() endDate?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string
}

export class ProvidersTimelineQueryDto extends ProvidersQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    description: 'Granularidade da série. Omitido = escolhida pelo tamanho do período.',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month'
}
