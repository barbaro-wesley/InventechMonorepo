import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator'
import { TenantStatus } from '@prisma/client'

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  document?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string

  @IsOptional()
  settings?: Record<string, any>
}