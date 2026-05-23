import {
    IsString, IsOptional, IsUUID, IsEnum, IsDateString, MinLength, MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MaintenanceType } from '@prisma/client'

export class CreateAccessoryMaintenanceDto {
    @ApiProperty({ enum: MaintenanceType })
    @IsEnum(MaintenanceType)
    type: MaintenanceType

    @ApiProperty({ example: 'Verificação de cabos' })
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observations?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    technicianId?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    scheduledAt?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    startedAt?: string
}

export class CompleteAccessoryMaintenanceDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observations?: string
}
