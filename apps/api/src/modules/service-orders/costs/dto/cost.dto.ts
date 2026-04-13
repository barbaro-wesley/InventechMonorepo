import {
    IsEnum, IsNumber, IsOptional, IsPositive, IsString,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CostItemType } from '@prisma/client'

export class CreateCostItemDto {
    @IsString()
    description: string

    @IsEnum(CostItemType)
    type: CostItemType

    @IsNumber({ maxDecimalPlaces: 3 })
    @IsPositive()
    @Type(() => Number)
    quantity: number

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Type(() => Number)
    unitPrice: number

    @IsOptional()
    @IsString()
    notes?: string
}

export class UpdateCostItemDto {
    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsEnum(CostItemType)
    type?: CostItemType

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @IsPositive()
    @Type(() => Number)
    quantity?: number

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Type(() => Number)
    unitPrice?: number

    @IsOptional()
    @IsString()
    notes?: string
}
