import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class ListPacientesDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(150)
  limit?: number = 150
}

export class PacienteInternadoDto {
  @ApiProperty({ example: 'PALMIRA LOURDES BASSANELLO TRICHES' })
  paciente: string

  @ApiPropertyOptional({ example: 57203 })
  prontuario: number | null

  @ApiProperty({ example: '28/04/2026' })
  data_entrada: string

  @ApiPropertyOptional({ example: '325 - SUITE INTELIGENTE - A' })
  leito: string | null

  @ApiPropertyOptional({ example: 'POSTO 3' })
  setor: string | null

  @ApiProperty({ example: 3 })
  dias_internacao: number

  @ApiPropertyOptional({ example: 85 })
  idade: number | null
}
