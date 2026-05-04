import {
  IsArray, IsBoolean, IsInt, IsOptional,
  IsString, IsUUID, Max, Min,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { FieldDefinition } from '../../../common/types/field-definition.types'

export class CreateChecklistTemplateDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields: FieldDefinition[]

  @IsOptional()
  @IsUUID()
  clientId?: string

  @IsOptional()
  @IsBoolean()
  isSharedWithClients?: boolean
}

export class UpdateChecklistTemplateDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields?: FieldDefinition[]

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  isSharedWithClients?: boolean
}

export class ListChecklistTemplatesDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsUUID()
  clientId?: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean

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
}
