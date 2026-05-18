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

    @IsEnum(['ENTRY', 'EXIT', 'ADJUSTMENT'])
    type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT'

    @IsNumber({ maxDecimalPlaces: 3 })
    @IsPositive()
    @Type(() => Number)
    quantity: number

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Type(() => Number)
    unitCost?: number

    @IsOptional()
    @IsString()
    reason?: string

    @IsOptional()
    @IsString()
    notes?: string
}

export class CreateTransferDto {
    @IsUUID()
    itemId: string

    @IsUUID()
    destinationPointId: string

    @IsNumber({ maxDecimalPlaces: 3 })
    @IsPositive()
    @Type(() => Number)
    quantity: number

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
    @IsUUID()
    stockPointId?: string

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
