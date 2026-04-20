import {
  IsBoolean,
  IsIP,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreatePrinterDto {
  @IsString()
  @MaxLength(100)
  name: string

  @IsIP()
  ipAddress: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string

  @IsOptional()
  @IsUUID()
  costCenterId?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsIP()
  ipAddress?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string

  @IsOptional()
  @IsUUID()
  costCenterId?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean
}

export class ListPrintersDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean

  @IsOptional()
  @IsUUID()
  costCenterId?: string
}
