import {
    IsString,
    IsOptional,
    IsUUID,
    IsEnum,
    IsNumber,
    IsDateString,
    MinLength,
    MaxLength,
    Min,
    IsBoolean,
    IsInt,
    Validate,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { AccessoryOwnership, AccessoryStatus, EquipmentCriticality } from '@prisma/client'

/** Valida que warrantyEnd >= warrantyStart (quando ambos estão presentes) */
@ValidatorConstraint({ name: 'warrantyEndAfterStart', async: false })
class WarrantyEndAfterStartConstraint implements ValidatorConstraintInterface {
    validate(warrantyEnd: string, args: ValidationArguments) {
        const obj = args.object as CreateAccessoryDto
        if (!obj.warrantyStart || !warrantyEnd) return true
        return new Date(warrantyEnd) >= new Date(obj.warrantyStart)
    }
    defaultMessage() {
        return 'warrantyEnd deve ser maior ou igual a warrantyStart'
    }
}

export class CreateAccessoryDto {
    @ApiProperty({ example: 'Cabo ECG 10 vias' })
    @IsString()
    @MinLength(2)
    @MaxLength(150)
    name: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    categoryId?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    brand?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    serialNumber?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(50)
    patrimonyNumber?: string

    @ApiPropertyOptional({ description: 'Se não fornecido, será gerado automaticamente' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    qrCode?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(50)
    anvisaNumber?: string

    @ApiProperty({ enum: AccessoryOwnership, default: AccessoryOwnership.COMPANY })
    @IsEnum(AccessoryOwnership)
    ownership: AccessoryOwnership

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    purchaseValue?: number

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    purchaseDate?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(80)
    invoiceNumber?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    warrantyStart?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    @Validate(WarrantyEndAfterStartConstraint)
    warrantyEnd?: string

    @ApiProperty({ enum: EquipmentCriticality, default: EquipmentCriticality.MEDIUM })
    @IsEnum(EquipmentCriticality)
    criticality: EquipmentCriticality

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observations?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    currentLocationId?: string
}

export class UpdateAccessoryDto extends PartialType(CreateAccessoryDto) { }

export class ListAccessoriesDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string

    @ApiPropertyOptional({ enum: AccessoryStatus })
    @IsOptional()
    @IsEnum(AccessoryStatus)
    status?: AccessoryStatus

    @ApiPropertyOptional({ enum: EquipmentCriticality })
    @IsOptional()
    @IsEnum(EquipmentCriticality)
    criticality?: EquipmentCriticality

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    categoryId?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    currentEquipmentId?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    currentLocationId?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    qrCode?: string

    @ApiPropertyOptional({ description: 'Somente acessórios com garantia vencida (true) ou vencendo em 30 dias (expiring)' })
    @IsOptional()
    @IsString()
    warrantyFilter?: 'expired' | 'expiring'

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page?: number = 1

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    limit?: number = 20
}
