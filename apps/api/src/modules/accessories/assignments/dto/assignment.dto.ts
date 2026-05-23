import { IsUUID, IsOptional, IsString, MaxLength, IsNotEmpty } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AssignAccessoryDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    equipmentId: string

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string
}

export class UnassignAccessoryDto {
    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    unassignReason?: string
}
