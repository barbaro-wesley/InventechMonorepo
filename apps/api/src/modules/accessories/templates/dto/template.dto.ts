import {
    IsUUID, IsOptional, IsBoolean, IsInt, IsString, Min, IsNotEmpty,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'

export class CreateAccessoryTemplateDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    equipmentTypeId: string

    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    categoryId: string

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    isRequired?: boolean = false

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    minQuantity?: number = 1

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    maxQuantity?: number

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string
}

export class UpdateAccessoryTemplateDto extends PartialType(CreateAccessoryTemplateDto) { }
