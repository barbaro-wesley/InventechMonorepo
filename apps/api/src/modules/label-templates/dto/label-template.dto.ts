import {
  IsString, IsOptional, IsBoolean, IsEnum, IsArray,
  IsNumber, Min, Max, ValidateNested, IsInt, IsObject,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { LabelReferenceType } from '@prisma/client'

// ─── Layout types (stored as JSON in LabelTemplate.layout) ─────────────────────
// Todas as coordenadas/dimensões estão em milímetros (mm), relativas à etiqueta.

export type LabelElementType = 'text' | 'qrcode' | 'image' | 'table' | 'line' | 'rect'

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
export type LabelTableColumnKey =
  | 'number'
  | 'createdAt'
  | 'description'
  | 'status'
  | 'client'
  | 'technician'

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
  /** Na impressão em folha (mala-direta), indica se o conteúdo varia por etiqueta. */
  perCell?: boolean
}

export interface LabelQrElement extends LabelElementBase {
  type: 'qrcode'
  value: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  /** Na impressão em folha (mala-direta), indica se o valor varia por etiqueta. */
  perCell?: boolean
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

/** Linha divisória (horizontal ou vertical) dentro da etiqueta. */
export interface LabelLineElement extends LabelElementBase {
  type: 'line'
  color?: string
  thickness?: number // mm
  orientation?: 'horizontal' | 'vertical'
}

/** Retângulo/moldura (preenchimento e/ou borda) para agrupar áreas da etiqueta. */
export interface LabelRectElement extends LabelElementBase {
  type: 'rect'
  fill?: string
  borderColor?: string
  borderWidth?: number // mm
  radius?: number // mm
}

export type LabelElement =
  | LabelTextElement
  | LabelQrElement
  | LabelImageElement
  | LabelTableElement
  | LabelLineElement
  | LabelRectElement

// ─── Folha de impressão (imposição em A4/A3/A5) ─────────────────────────────────

export type PaperSize = 'A4' | 'A3' | 'A5'

export interface LabelSheet {
  /** Se a etiqueta deve ser impressa numa folha com várias por página. */
  enabled: boolean
  paperSize: PaperSize
  orientation: 'portrait' | 'landscape'
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  columns: number
  rows: number
  gapX: number
  gapY: number
}

export interface LabelLayout {
  width: number
  height: number
  unit: 'mm'
  background?: string
  elements: LabelElement[]
  /** Configuração padrão de impressão em folha (opcional). */
  sheet?: LabelSheet
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

  // Sanitização profunda do sheet é feita no service (sanitizeSheet).
  @IsOptional() @IsObject()
  @Transform(({ obj, key }) => obj[key])
  sheet?: LabelSheet
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

// ─── Impressão em folha (mala-direta / imposição) ───────────────────────────────

export class RenderSheetOptionsDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean

  @IsOptional() @IsString()
  paperSize?: string

  @IsOptional() @IsString()
  orientation?: string

  @IsOptional() @IsNumber()
  marginTop?: number

  @IsOptional() @IsNumber()
  marginRight?: number

  @IsOptional() @IsNumber()
  marginBottom?: number

  @IsOptional() @IsNumber()
  marginLeft?: number

  @IsOptional() @IsInt()
  columns?: number

  @IsOptional() @IsInt()
  rows?: number

  @IsOptional() @IsNumber()
  gapX?: number

  @IsOptional() @IsNumber()
  gapY?: number
}

export class RenderSheetCellDto {
  // Mapa { elementId: valor } com o conteúdo desta etiqueta (texto/QR).
  @IsOptional() @IsObject()
  overrides?: Record<string, string>
}

export class RenderSheetDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RenderSheetOptionsDto)
  sheet?: RenderSheetOptionsDto

  // Etiquetas avulsas: uma célula por etiqueta (com o conteúdo de cada uma).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RenderSheetCellDto)
  cells?: RenderSheetCellDto[]

  // Modo entidade: distribui vários equipamentos/OS pelo grid da folha.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityIds?: string[]
}
