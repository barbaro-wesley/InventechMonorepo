import {
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateStockItemDto {
    @IsUUID()
    stockPointId: string

    @IsOptional()
    @IsUUID()
    categoryId?: string

    @IsOptional()
    @IsString()
    code?: string

    @IsString()
    name: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    unit?: string

    @IsOptional()
    @IsString()
    brand?: string

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    @Type(() => Number)
    minimumQuantity?: number

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Type(() => Number)
    unitCost?: number
}

export class UpdateStockItemDto {
    @IsOptional()
    @IsUUID()
    categoryId?: string

    @IsOptional()
    @IsString()
    code?: string

    @IsOptional()
    @IsString()
    name?: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    unit?: string

    @IsOptional()
    @IsString()
    brand?: string

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    @Type(() => Number)
    minimumQuantity?: number

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Type(() => Number)
    unitCost?: number

    @IsOptional()
    @IsBoolean()
    isActive?: boolean
}

export class ListStockItemsDto {
    @IsOptional()
    @IsUUID()
    stockPointId?: string

    @IsOptional()
    @IsUUID()
    categoryId?: string

    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    belowMinimum?: boolean

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
