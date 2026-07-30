import { IsInt, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdatePreventiveSlaDto {
  @ApiProperty({
    description: 'Prazo máximo (em dias) para conclusão da OS preventiva após a abertura automática. Após esse prazo a OS é classificada como atrasada.',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  executionDays: number
}
