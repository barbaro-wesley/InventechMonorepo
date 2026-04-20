import { IsEnum, IsOptional, IsUUID } from 'class-validator'
import { ScanStatus } from '@prisma/client'

export class ListScansDto {
  @IsOptional()
  @IsUUID()
  printerId?: string

  @IsOptional()
  @IsEnum(ScanStatus)
  status?: ScanStatus
}
