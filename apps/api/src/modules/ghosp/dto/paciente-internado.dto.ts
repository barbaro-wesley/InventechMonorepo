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
  limit?: number = 20
}

export class PacienteInternadoDto {
  @ApiProperty({ example: 57203 })
  id_paciente: number

  @ApiProperty({ example: 'PALMIRA LOURDES BASSANELLO TRICHES' })
  paciente: string

  @ApiPropertyOptional({ example: 57203 })
  prontuario: number | null

  @ApiProperty({ example: '2026-04-24' })
  data_entrada: string

  @ApiProperty({ example: 3 })
  dias_internacao: number

  @ApiPropertyOptional({ example: '325 - SUITE INTELIGENTE - A' })
  leito: string | null

  @ApiPropertyOptional({ example: 'Suite' })
  tipo_leito: string | null

  @ApiPropertyOptional({ example: 'POSTO 3' })
  setor: string | null

  @ApiPropertyOptional({ example: 'POSTO 3' })
  setor_atual: string | null

  @ApiPropertyOptional({ example: '19/02/1941' })
  data_nasc: string | null

  @ApiPropertyOptional({ example: 85 })
  idade: number | null

  @ApiPropertyOptional({ example: 'SIM' })
  permite_visita: string | null

  @ApiPropertyOptional({ example: 'Feminino' })
  sexo: string | null

  @ApiPropertyOptional({ example: 'HENRIQUE TESSARO' })
  medico: string | null

  @ApiPropertyOptional({ example: 'NÃO' })
  isolado: string | null

  @ApiPropertyOptional({ example: 'Marau' })
  cidade: string | null

  @ApiPropertyOptional({ example: 2 })
  qtd_visitas: number | null

  @ApiPropertyOptional({ example: 1 })
  qtd_acompanhantes: number | null
}
