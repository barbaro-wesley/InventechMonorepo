import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateStockCategoryDto {
    @IsString()
    name: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    color?: string
}

export class UpdateStockCategoryDto {
    @IsOptional()
    @IsString()
    name?: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    color?: string

    @IsOptional()
    @IsBoolean()
    isActive?: boolean
}

export class ListStockCategoriesDto {
    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean

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
