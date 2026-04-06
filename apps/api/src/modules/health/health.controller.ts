import { Controller, Get, Inject } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import type Redis from 'ioredis'
import { Public } from '../../common/decorators/public.decorator'
import { NoRateLimit } from '../../common/decorators/rate-limit.decorator'
import { PrismaService } from '../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../common/providers/redis.provider'

@ApiTags('Health')
@Controller('health')
export class HealthController {
    private minioClient: Minio.Client

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {
        this.minioClient = new Minio.Client({
            endPoint: this.configService.get('minio.endpoint', 'localhost'),
            port: this.configService.get<number>('minio.port', 9000),
            useSSL: this.configService.get<boolean>('minio.useSSL', false),
            accessKey: this.configService.get('minio.accessKey', ''),
            secretKey: this.configService.get('minio.secretKey', ''),
        })
    }

    @Get()
    @Public()
    @NoRateLimit()
    @ApiOperation({
        summary: 'Health check completo',
        description: 'Verifica status de todos os serviços: API, Prisma/PostgreSQL, Redis e MinIO.',
    })
    async check() {
        const start = Date.now()

        const [db, redis, minio] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
            this.checkMinio(),
        ])

        const allHealthy = db.status === 'up' && redis.status === 'up' && minio.status === 'up'

        return {
            status: allHealthy ? 'ok' : 'degraded',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            responseTime: `${Date.now() - start}ms`,
            services: {
                api: {
                    status: 'up',
                    version: process.env.npm_package_version ?? '1.0.0',
                    environment: process.env.NODE_ENV ?? 'development',
                    memory: {
                        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
                        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
                    },
                },
                database: db,
                redis,
                minio,
            },
        }
    }

    // GET /health/ping — verificação mínima (para load balancer)
    @Get('ping')
    @Public()
    @NoRateLimit()
    @ApiOperation({
        summary: 'Ping',
        description: 'Verificação mínima de disponibilidade. Não checa serviços externos.',
    })
    ping() {
        return { status: 'ok', timestamp: new Date().toISOString() }
    }

    // ─────────────────────────────────────────
    // Checks individuais
    // ─────────────────────────────────────────

    private async checkDatabase(): Promise<{ status: 'up' | 'down'; responseTime: string; error?: string }> {
        const start = Date.now()
        try {
            await this.prisma.$queryRaw`SELECT 1`
            return { status: 'up', responseTime: `${Date.now() - start}ms` }
        } catch (error) {
            return { status: 'down', responseTime: `${Date.now() - start}ms`, error: error.message }
        }
    }

    private async checkRedis(): Promise<{ status: 'up' | 'down'; responseTime: string; error?: string }> {
        const start = Date.now()
        try {
            const pong = await this.redis.ping()
            if (pong !== 'PONG') throw new Error('Resposta inesperada do Redis')
            return { status: 'up', responseTime: `${Date.now() - start}ms` }
        } catch (error) {
            return { status: 'down', responseTime: `${Date.now() - start}ms`, error: error.message }
        }
    }

    private async checkMinio(): Promise<{ status: 'up' | 'down'; responseTime: string; error?: string }> {
        const start = Date.now()
        try {
            await this.minioClient.listBuckets()
            return { status: 'up', responseTime: `${Date.now() - start}ms` }
        } catch (error) {
            return { status: 'down', responseTime: `${Date.now() - start}ms`, error: error.message }
        }
    }
}
