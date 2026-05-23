import { IsString, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'

export class CreateAccessoryCategoryDto {
    @ApiProperty({ example: 'Cabos e Eletrodos' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string

    @ApiPropertyOptional({ example: '#6366F1' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string
}

export class UpdateAccessoryCategoryDto extends PartialType(CreateAccessoryCategoryDto) {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean
}
