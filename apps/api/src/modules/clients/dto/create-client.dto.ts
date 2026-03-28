import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ClientStatus } from '@prisma/client'

class AddressDto {
  @IsOptional()
  @IsString()
  street?: string

  @IsOptional()
  @IsString()
  number?: string

  @IsOptional()
  @IsString()
  complement?: string

  @IsOptional()
  @IsString()
  neighborhood?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  state?: string

  @IsOptional()
  @IsString()
  zip?: string
}

// Administrador inicial do cliente — criado junto na mesma transação
export class CreateClientAdminDto {
  @IsString()
  name: string

  @IsEmail({}, { message: 'Email do administrador inválido' })
  email: string

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string

  @IsOptional()
  @IsString()
  phone?: string
}

export class CreateClientDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  document?: string  // CNPJ

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus = ClientStatus.ACTIVE

  @IsOptional()
  @IsUUID()
  companyId?: string  // Usado pelo SUPER_ADMIN para criar clientes em outras empresas

  // Administrador inicial do cliente — criado junto na mesma transação
  @ValidateNested()
  @Type(() => CreateClientAdminDto)
  admin: CreateClientAdminDto
}