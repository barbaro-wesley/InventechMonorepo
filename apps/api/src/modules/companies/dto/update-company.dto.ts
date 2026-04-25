import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
} from 'class-validator'
import { CompanyStatus } from '@prisma/client'

export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() document?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus
  @IsOptional() @IsDateString() trialEndsAt?: string
  @IsOptional() settings?: Record<string, any>

  // Endereço
  @IsOptional() @IsString() street?: string
  @IsOptional() @IsString() number?: string
  @IsOptional() @IsString() complement?: string
  @IsOptional() @IsString() neighborhood?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsString() state?: string
  @IsOptional() @IsString() zipCode?: string

  // Visual dos relatórios
  @IsOptional() @IsHexColor() reportPrimaryColor?: string
  @IsOptional() @IsHexColor() reportSecondaryColor?: string
  @IsOptional() @IsString() reportHeaderTitle?: string
  @IsOptional() @IsString() reportFooterText?: string

  // Segurança
  @IsOptional() @IsBoolean() enforce2FAForAll?: boolean
}