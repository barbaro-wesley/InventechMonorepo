import {
    IsUUID, IsOptional, IsString, IsEnum, IsDateString, IsNotEmpty, Validate,
    ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MovementType } from '@prisma/client'

@ValidatorConstraint({ name: 'originDiffDestination', async: false })
class OriginDiffDestinationConstraint implements ValidatorConstraintInterface {
    validate(destinationLocationId: string, args: ValidationArguments) {
        const obj = args.object as CreateAccessoryMovementDto
        return obj.originLocationId !== destinationLocationId
    }
    defaultMessage() {
        return 'originLocationId e destinationLocationId não podem ser iguais'
    }
}

export class CreateAccessoryMovementDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    originLocationId: string

    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    @Validate(OriginDiffDestinationConstraint)
    destinationLocationId: string

    @ApiProperty({ enum: MovementType })
    @IsEnum(MovementType)
    type: MovementType

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reason?: string

    @ApiPropertyOptional({ description: 'Obrigatório quando type = LOAN' })
    @IsOptional()
    @IsDateString()
    expectedReturnAt?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string
}

export class ReturnAccessoryMovementDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string
}
