import { Injectable, OnModuleDestroy, OnModuleInit, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'
import type { PacienteInternadoDto } from './dto/paciente-internado.dto'

@Injectable()
export class GhospService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GhospService.name)
  private pool: Pool

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool({
      host: this.configService.get<string>('ghosp.host'),
      port: this.configService.get<number>('ghosp.port'),
      database: this.configService.get<string>('ghosp.database'),
      user: this.configService.get<string>('ghosp.user'),
      password: this.configService.get<string>('ghosp.password'),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })

    this.pool.on('error', (err) => {
      this.logger.error('Erro no pool GHOSP', err)
    })

    this.logger.log(`Pool GHOSP conectado em ${this.configService.get('ghosp.host')}`)
  }

  async onModuleDestroy() {
    await this.pool.end()
  }

  async listarPacientesInternados(
    page: number,
    limit: number,
  ): Promise<{ data: PacienteInternadoDto[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit

    try {
      const [dataResult, countResult] = await Promise.all([
        this.pool.query<PacienteInternadoDto>(
          'SELECT * FROM sigh.v_controle_acesso ORDER BY data_entrada DESC LIMIT $1 OFFSET $2',
          [limit, offset],
        ),
        this.pool.query<{ total: string }>(
          'SELECT COUNT(*) AS total FROM sigh.v_controle_acesso',
        ),
      ])

      return {
        data: dataResult.rows,
        total: parseInt(countResult.rows[0].total, 10),
        page,
        limit,
      }
    } catch (err) {
      this.logger.error('Erro ao consultar sigh.v_controle_acesso', err)
      throw new InternalServerErrorException('Falha ao consultar o banco GHOSP')
    }
  }
}
