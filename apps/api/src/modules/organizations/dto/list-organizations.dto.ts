import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { OrgStatus } from '@prisma/client'

export class ListClientsDto {
  @IsOptional()
  @IsString()
  search?: string  // Busca por nome, documento ou email

  @IsOptional()
  @IsEnum(OrgStatus)
  status?: OrgStatus

  @IsOptional()
  @IsUUID()
  tenantId?: string  // Usado pelo SUPER_ADMIN para filtrar por empresa

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