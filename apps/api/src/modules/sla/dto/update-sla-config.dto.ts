import { IsEnum, IsNumber, Min, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { ServiceOrderPriority } from '@prisma/client'

export class UpdateSlaConfigDto {
  @ApiProperty({ enum: ServiceOrderPriority })
  @IsEnum(ServiceOrderPriority)
  priority: ServiceOrderPriority

  @ApiProperty({ description: 'Horas máximas para primeira resposta/início', example: 2 })
  @IsNumber()
  @Min(0)
  maxResponseHours: number

  @ApiProperty({ description: 'Horas máximas para resolução/conclusão', example: 12 })
  @IsNumber()
  @Min(0)
  maxResolutionHours: number
}

export class BatchUpdateSlaConfigDto {
  @ApiProperty({ type: [UpdateSlaConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSlaConfigDto)
  configs: UpdateSlaConfigDto[]
}
