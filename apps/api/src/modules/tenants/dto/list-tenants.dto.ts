import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { TenantStatus } from '@prisma/client'

export class ListCompaniesDto {
  @IsOptional()
  @IsString()
  search?: string  // Busca por nome ou documento

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus

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