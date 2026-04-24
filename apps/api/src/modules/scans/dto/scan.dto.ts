import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
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
}

export class ScanWebhookDto {
  @IsUUID()
  scanId: string

  @IsUUID()
  companyId: string

  @IsEnum(ScanStatus)
  status: ScanStatus
}
