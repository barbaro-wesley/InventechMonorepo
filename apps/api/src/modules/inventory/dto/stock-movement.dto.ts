import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { StockMovementType } from '@prisma/client'

export class CreateStockMovementDto {
    @IsUUID()
    itemId: string

    @IsEnum(StockMovementType)
    type: StockMovementType

    @IsNumber({ maxDecimalPlaces: 3 })
    @IsPositive()
    @Type(() => Number)
    quantity: number

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Type(() => Number)
    unitCost?: number

    @IsOptional()
    @IsString()
    reason?: string

    @IsOptional()
    @IsString()
    notes?: string
}

export class ListStockMovementsDto {
    @IsOptional()
    @IsUUID()
    itemId?: string

    @IsOptional()
    @IsEnum(StockMovementType)
    type?: StockMovementType

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page?: number

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    limit?: number
}
