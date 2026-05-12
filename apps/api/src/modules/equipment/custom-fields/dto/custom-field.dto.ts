import {
    IsArray, IsBoolean, IsEnum, IsInt, IsOptional,
    IsString, IsUUID, Min, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CustomFieldType } from '@prisma/client'

export class CreateCustomFieldDefinitionDto {
    @IsString()
    name: string

    @IsEnum(CustomFieldType)
    fieldType: CustomFieldType

    @IsOptional()
    @IsBoolean()
    required?: boolean

    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[]
}

export class UpdateCustomFieldDefinitionDto {
    @IsOptional()
    @IsString()
    name?: string

    @IsOptional()
    @IsEnum(CustomFieldType)
    fieldType?: CustomFieldType

    @IsOptional()
    @IsBoolean()
    required?: boolean

    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[]

    @IsOptional()
    @IsBoolean()
    isActive?: boolean
}

export class ReorderCustomFieldsDto {
    @IsArray()
    @IsUUID(undefined, { each: true })
    ids: string[]
}

export class CustomFieldValueDto {
    @IsUUID()
    definitionId: string

    @IsOptional()
    @IsString()
    value?: string
}

export class UpsertCustomFieldValuesDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomFieldValueDto)
    values: CustomFieldValueDto[]
}
