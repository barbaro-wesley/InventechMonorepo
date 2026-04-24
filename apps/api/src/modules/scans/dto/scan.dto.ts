import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ScanStatus } from '@prisma/client'

export class ListScansDto {
  @IsOptional()
  @IsUUID()
  printerId?: string

  @IsOptional()
  @IsEnum(ScanStatus)
  status?: ScanStatus

  // Busca livre: paciente, prontuário, nº atendimento/RA/número interno
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string

  // Paginação cursor-based — cursor é o scannedAt do último item recebido (ISO string)
  @IsOptional()
  @IsString()
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class ScanWebhookDto {
  @IsUUID()
  scanId: string

  @IsUUID()
  companyId: string

  @IsEnum(ScanStatus)
  status: ScanStatus
}
