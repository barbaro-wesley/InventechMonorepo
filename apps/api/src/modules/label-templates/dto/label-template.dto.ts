import {
  IsString, IsOptional, IsBoolean, IsEnum, IsArray,
  IsNumber, Min, Max, ValidateNested, IsInt,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { LabelReferenceType } from '@prisma/client'

// ─── Layout types (stored as JSON in LabelTemplate.layout) ─────────────────────
// Todas as coordenadas/dimensões estão em milímetros (mm), relativas à etiqueta.

export type LabelElementType = 'text' | 'qrcode' | 'image' | 'table'

export interface LabelElementBase {
  id: string
  type: LabelElementType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

/** Colunas disponíveis na tabela de OS preventivas. */
export type LabelTableColumnKey = 'number' | 'createdAt' | 'description' | 'status'

export interface LabelTableColumn {
  key: LabelTableColumnKey
  label: string
  width: number // peso relativo da coluna
}

export interface LabelTextElement extends LabelElementBase {
  type: 'text'
  content: string
  fontSize: number // pt
  fontWeight?: 'normal' | 'bold'
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  color?: string
}

export interface LabelQrElement extends LabelElementBase {
  type: 'qrcode'
  value: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

export interface LabelImageElement extends LabelElementBase {
  type: 'image'
  source: 'company_logo'
  fit?: 'contain' | 'cover'
}

/** Tabela desenhada com as OS preventivas do equipamento. */
export interface LabelTableElement extends LabelElementBase {
  type: 'table'
  source: 'preventive_os'
  columns: LabelTableColumn[]
  fontSize: number // pt
  headerBold?: boolean
  showHeader?: boolean
  showBorders?: boolean
  maxRows?: number
  color?: string
}

export type LabelElement =
  | LabelTextElement
  | LabelQrElement
  | LabelImageElement
  | LabelTableElement

export interface LabelLayout {
  width: number
  height: number
  unit: 'mm'
  background?: string
  elements: LabelElement[]
}

// ─── DTOs ──────────────────────────────────────────────────────────────────────
// A validação profunda dos elementos é feita por sanitização no service
// (mesma filosofia do módulo de laudos), mantendo a DTO resiliente.

export class LabelLayoutDto {
  @IsNumber() @Min(5) @Max(500)
  width: number

  @IsNumber() @Min(5) @Max(500)
  height: number

  @IsOptional() @IsString()
  unit?: string

  @IsOptional() @IsString()
  background?: string

  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  elements: LabelElement[]
}

export class CreateLabelTemplateDto {
  @IsString()
  name: string

  @IsOptional() @IsString()
  description?: string

  @IsEnum(LabelReferenceType)
  referenceType: LabelReferenceType

  @ValidateNested()
  @Type(() => LabelLayoutDto)
  layout: LabelLayoutDto

  @IsOptional() @IsBoolean()
  isDefault?: boolean

  @IsOptional() @IsBoolean()
  isActive?: boolean
}

export class UpdateLabelTemplateDto {
  @IsOptional() @IsString()
  name?: string

  @IsOptional() @IsString()
  description?: string

  @IsOptional() @IsEnum(LabelReferenceType)
  referenceType?: LabelReferenceType

  @IsOptional()
  @ValidateNested()
  @Type(() => LabelLayoutDto)
  layout?: LabelLayoutDto

  @IsOptional() @IsBoolean()
  isDefault?: boolean

  @IsOptional() @IsBoolean()
  isActive?: boolean
}

export class ListLabelTemplatesDto {
  @IsOptional() @IsEnum(LabelReferenceType)
  referenceType?: LabelReferenceType

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean

  @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  page?: number

  @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  limit?: number
}

export class RenderLabelsDto {
  @IsArray()
  @IsString({ each: true })
  entityIds: string[]
}
