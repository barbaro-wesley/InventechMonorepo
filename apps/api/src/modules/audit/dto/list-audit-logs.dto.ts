import { AuditAction } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class ListAuditLogsDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number = 1

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
    limit?: number = 50

    /** Nome do model, ex.: "Equipment", "ServiceOrder" */
    @IsOptional() @IsString()
    entity?: string

    @IsOptional() @IsString()
    entityId?: string

    @IsOptional() @IsEnum(AuditAction)
    action?: AuditAction

    @IsOptional() @IsUUID()
    userId?: string

    @IsOptional() @IsUUID()
    companyId?: string

    /** Busca por e-mail do usuário, id do registro ou rota */
    @IsOptional() @IsString()
    search?: string

    @IsOptional() @IsDateString()
    dateFrom?: string

    @IsOptional() @IsDateString()
    dateTo?: string
}
