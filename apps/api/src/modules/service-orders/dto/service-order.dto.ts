import {
    IsEnum, IsInt, IsOptional, IsString,
    IsUUID, Max, Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import {
    MaintenanceType,
    ServiceOrderPriority,
    ServiceOrderStatus,
    ServiceOrderTechnicianRole,
} from '@prisma/client'

export class CreateServiceOrderDto {
    // Equipamento é opcional — pode criar OS sem vínculo
    @IsOptional()
    @IsUUID()
    equipmentId?: string

    // Centro de custo e localização (obrigatórios quando não há equipamento)
    @IsOptional()
    @IsUUID()
    costCenterId?: string

    @IsOptional()
    @IsUUID()
    locationId?: string

    @IsString()
    title: string

    @IsString()
    description: string

    @IsEnum(MaintenanceType)
    maintenanceType: MaintenanceType

    @IsOptional()
    @IsEnum(ServiceOrderPriority)
    priority?: ServiceOrderPriority = ServiceOrderPriority.MEDIUM

    // Grupo responsável — roteamento da OS
    @IsOptional()
    @IsUUID()
    groupId?: string

    @IsOptional()
    @IsUUID()
    technicianId?: string

    @IsOptional()
    @IsString()
    scheduledFor?: string

    @IsOptional()
    @IsInt()
    @Min(1)
    alertAfterHours?: number
}

export class UpdateServiceOrderDto {
    @IsOptional()
    @IsString()
    title?: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsEnum(ServiceOrderPriority)
    priority?: ServiceOrderPriority

    @IsOptional()
    @IsEnum(MaintenanceType)
    maintenanceType?: MaintenanceType

    @IsOptional()
    @IsUUID()
    clientId?: string

    @IsOptional()
    @IsUUID()
    groupId?: string

    @IsOptional()
    @IsString()
    scheduledFor?: string

    @IsOptional()
    @IsString()
    resolution?: string

    @IsOptional()
    @IsString()
    internalNotes?: string

    @IsOptional()
    @IsInt()
    @Min(1)
    alertAfterHours?: number
}

export class UpdateServiceOrderStatusDto {
    @IsEnum(ServiceOrderStatus)
    status: ServiceOrderStatus

    @IsOptional()
    @IsString()
    reason?: string

    @IsOptional()
    @IsString()
    resolution?: string
}

export class AssignTechnicianDto {
    @IsUUID()
    technicianId: string

    @IsOptional()
    @IsEnum(ServiceOrderTechnicianRole)
    role?: ServiceOrderTechnicianRole  // LEAD ou ASSISTANT
}

export class ListServiceOrdersDto {
    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @IsEnum(ServiceOrderStatus)
    status?: ServiceOrderStatus

    @IsOptional()
    @IsEnum(ServiceOrderPriority)
    priority?: ServiceOrderPriority

    @IsOptional()
    @IsUUID()
    equipmentId?: string

    @IsOptional()
    @IsUUID()
    groupId?: string

    @IsOptional()
    @IsString()
    dateFrom?: string

    @IsOptional()
    @IsString()
    dateTo?: string

    @IsOptional()
    @Type(() => Number)
    @IsInt() @Min(1)
    page?: number = 1

    @IsOptional()
    @Type(() => Number)
    @IsInt() @Min(1) @Max(100)
    limit?: number = 20
}

// Filtros para o painel de OS disponíveis
export class ListAvailableServiceOrdersDto {
    @IsOptional()
    @IsUUID()
    groupId?: string  // Filtrar por grupo específico

    @IsOptional()
    @Type(() => Number)
    @IsInt() @Min(1)
    page?: number = 1

    @IsOptional()
    @Type(() => Number)
    @IsInt() @Min(1) @Max(100)
    limit?: number = 20
}