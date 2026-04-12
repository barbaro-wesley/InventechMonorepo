import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, IsString } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { EventType } from '@prisma/client'

export class ListAlertRulesDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20

    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @IsEnum(EventType)
    triggerEvent?: EventType

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    isActive?: boolean
}
