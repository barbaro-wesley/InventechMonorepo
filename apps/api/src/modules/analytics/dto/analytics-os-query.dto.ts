import { IsOptional, IsDateString, IsUUID, IsInt, Min, Max, IsIn, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { MaintenanceType, ServiceOrderPriority } from '@prisma/client'

export class OsBaseQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01' }) @IsOptional() @IsDateString() startDate?: string
  @ApiPropertyOptional({ example: '2025-12-31' }) @IsOptional() @IsDateString() endDate?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string
  @ApiPropertyOptional({ enum: MaintenanceType }) @IsOptional() @IsEnum(MaintenanceType) maintenanceType?: MaintenanceType
  @ApiPropertyOptional({ enum: ServiceOrderPriority }) @IsOptional() @IsEnum(ServiceOrderPriority) priority?: ServiceOrderPriority
}

export class OsTimelineQueryDto extends OsBaseQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month'
}

export class TechnicianRankingQueryDto extends OsBaseQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() technicianId?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class OsBacklogQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string
}

export class OsComparisonQueryDto extends OsBaseQueryDto {}

export class OsCostsQueryDto extends OsBaseQueryDto {
  @ApiPropertyOptional({ enum: ['client', 'group', 'maintenanceType', 'technician'], default: 'maintenanceType' })
  @IsOptional()
  @IsIn(['client', 'group', 'maintenanceType', 'technician'])
  groupBy?: 'client' | 'group' | 'maintenanceType' | 'technician'

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}
