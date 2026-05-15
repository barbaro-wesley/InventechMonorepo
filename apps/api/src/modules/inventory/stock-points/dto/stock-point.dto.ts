import {
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateStockPointDto {
    @IsString()
    @MinLength(2)
    name: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    clientIds?: string[]
}

export class UpdateStockPointDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    name?: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsBoolean()
    isActive?: boolean
}

export class AssignClientsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    clientIds: string[]
}

export class ListStockPointsDto {
    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean

    @IsOptional()
    @IsUUID()
    clientId?: string
}
