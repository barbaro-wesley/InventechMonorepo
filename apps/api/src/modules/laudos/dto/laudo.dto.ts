import {
  IsString, IsOptional, IsBoolean, IsEnum, IsArray,
  IsObject, IsInt, Min, ValidateNested, IsIn, IsNumber,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { LaudoReferenceType, LaudoStatus } from '@prisma/client'

// ─── Field types ─────────────────────────────────────────────────────────────

export type LaudoFieldType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'TABLE'
  | 'MULTI_SELECT'
  | 'SINGLE_SELECT'
  | 'CHECKBOX'
  | 'HEADING'
  | 'DIVIDER'
  | 'IMAGE'

export const LAUDO_FIELD_TYPES: LaudoFieldType[] = [
  'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'TABLE',
  'MULTI_SELECT', 'SINGLE_SELECT', 'CHECKBOX', 'HEADING', 'DIVIDER', 'IMAGE',
]

export interface LaudoTableColumn {
  key: string
  label: string
  type?: 'text' | 'number'
}

export interface LaudoFieldDefinition {
  id: string
  type: LaudoFieldType
  label: string
  placeholder?: string
  required?: boolean
  order: number
  width?: 'full' | 'half'
  options?: string[]           // MULTI_SELECT | SINGLE_SELECT
  tableColumns?: LaudoTableColumn[]  // TABLE
  variable?: string            // e.g. '{equipment_name}' — auto-filled on creation
  value?: any                  // filled value (only in Laudo, not template)
}

// ─── Signature config ────────────────────────────────────────────────────────

export type LaudoSignerType =
  | 'ASSUMED_TECHNICIAN'
  | 'CREATED_BY'
  | 'CLIENT_ADMIN'
  | 'COMPANY_ADMIN'
  | 'SPECIFIC_USER'

export interface SignatureSignerConfig {
  type: LaudoSignerType
  signerRole: string
  specificUserId?: string
  signingOrder?: number
}

export interface LaudoSignatureConfig {
  requireSignature: boolean
  requireSigningOrder: boolean
  customMessage?: string
  expiresInDays?: number
  signers: SignatureSignerConfig[]
}

export class SignatureSignerConfigDto {
  @IsIn(['ASSUMED_TECHNICIAN', 'CREATED_BY', 'CLIENT_ADMIN', 'COMPANY_ADMIN', 'SPECIFIC_USER'])
  type: LaudoSignerType

  @IsString()
  signerRole: string

  @IsOptional()
  @IsString()
  specificUserId?: string

  @IsOptional()
  @IsInt() @Min(0)
  signingOrder?: number
}

export class LaudoSignatureConfigDto {
  @IsBoolean()
  requireSignature: boolean

  @IsBoolean()
  requireSigningOrder: boolean

  @IsOptional()
  @IsString()
  customMessage?: string

  @IsOptional()
  @IsInt() @Min(1)
  expiresInDays?: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignatureSignerConfigDto)
  signers: SignatureSignerConfigDto[]
}

// ─── Template DTOs ────────────────────────────────────────────────────────────

export class CreateLaudoTemplateDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(LaudoReferenceType)
  referenceType: LaudoReferenceType

  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields: LaudoFieldDefinition[]

  @IsOptional()
  @IsString()
  clientId?: string

  @IsOptional()
  @IsBoolean()
  isSharedWithClients?: boolean

  @IsOptional()
  @IsObject()
  signatureConfig?: LaudoSignatureConfig
}

export class UpdateLaudoTemplateDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(LaudoReferenceType)
  referenceType?: LaudoReferenceType

  @IsOptional()
  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields?: LaudoFieldDefinition[]

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  isSharedWithClients?: boolean

  @IsOptional()
  @IsObject()
  signatureConfig?: LaudoSignatureConfig | null
}

export class ListLaudoTemplatesDto {
  @IsOptional()
  @IsEnum(LaudoReferenceType)
  referenceType?: LaudoReferenceType

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsString()
  clientId?: string

  @IsOptional()
  @IsInt() @Min(1)
  @Type(() => Number)
  page?: number

  @IsOptional()
  @IsInt() @Min(1)
  @Type(() => Number)
  limit?: number
}

// ─── Laudo DTOs ───────────────────────────────────────────────────────────────

export class CreateLaudoDto {
  @IsString()
  title: string

  @IsEnum(LaudoReferenceType)
  referenceType: LaudoReferenceType

  @IsOptional()
  @IsString()
  clientId?: string

  @IsOptional()
  @IsString()
  templateId?: string

  @IsOptional()
  @IsString()
  serviceOrderId?: string

  @IsOptional()
  @IsString()
  maintenanceId?: string

  @IsOptional()
  @IsString()
  technicianId?: string

  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields: LaudoFieldDefinition[]

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  expiresAt?: string
}

export class UpdateLaudoDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsArray()
  @Transform(({ obj, key }) => obj[key])
  fields?: LaudoFieldDefinition[]

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  technicianId?: string

  @IsOptional()
  expiresAt?: string
}

export class SignerForLaudoDto {
  @IsString()
  signerName: string

  @IsString()
  signerEmail: string

  @IsOptional()
  @IsString()
  signerPhone?: string

  @IsOptional()
  @IsString()
  signerCpf?: string

  @IsString()
  signerRole: string

  @IsOptional()
  @IsInt() @Min(0)
  signingOrder?: number
}

export class InitiateLaudoSignDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignerForLaudoDto)
  signers?: SignerForLaudoDto[]

  @IsOptional()
  @IsBoolean()
  requireSigningOrder?: boolean

  @IsOptional()
  expiresAt?: string

  @IsOptional()
  @IsString()
  customMessage?: string
}

export class ListLaudosDto {
  @IsOptional()
  @IsString()
  clientId?: string

  @IsOptional()
  @IsEnum(LaudoStatus)
  status?: LaudoStatus

  @IsOptional()
  @IsEnum(LaudoReferenceType)
  referenceType?: LaudoReferenceType

  @IsOptional()
  @IsString()
  serviceOrderId?: string

  @IsOptional()
  @IsString()
  maintenanceId?: string

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsInt() @Min(1)
  @Type(() => Number)
  page?: number

  @IsOptional()
  @IsInt() @Min(1)
  @Type(() => Number)
  limit?: number
}
