import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { UserRole, UserStatus } from '@prisma/client'

export class ListUsersDto {
  @IsOptional()
  @IsString()
  search?: string  // Busca por nome ou email

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus

  @IsOptional()
  @IsUUID()
  clientId?: string

  @IsOptional()
  @IsUUID()
  companyId?: string  // Usado pelo SUPER_ADMIN para filtrar por empresa

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}