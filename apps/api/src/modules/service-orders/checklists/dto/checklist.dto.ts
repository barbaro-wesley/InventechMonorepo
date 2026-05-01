import { IsArray, IsOptional } from 'class-validator'
import { Transform } from 'class-transformer'
import { FieldDefinition } from '../../../../common/types/field-definition.types'

export class FillChecklistDto {
  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields: FieldDefinition[]
}

export class CompleteChecklistDto {
  @IsOptional()
  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields?: FieldDefinition[]
}
