import { SetMetadata } from '@nestjs/common'

export const RATE_LIMIT_KEY = 'rate_limit'

export interface RateLimitOptions {
    limit: number    // Número máximo de requests
    ttl: number      // Janela de tempo em segundos
    message?: string // Mensagem de erro customizada
}

/**
 * Define um rate limit customizado para uma rota específica.
 * Sobrescreve o limite global.
 *
 * @example
 * @RateLimit({ limit: 5, ttl: 60 }) // 5 requests por minuto
 * @Post('login')
 */
export const RateLimit = (options: RateLimitOptions) =>
    SetMetadata(RATE_LIMIT_KEY, options)

/**
 * Marca uma rota como sem rate limit.
 */
export const NoRateLimit = () => SetMetadata(RATE_LIMIT_KEY, { skip: true })

import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../providers/redis.provider'

@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name)

    constructor(
        private reflector: Reflector,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const options = this.reflector.getAllAndOverride<RateLimitOptions & { skip?: boolean }>(
            RATE_LIMIT_KEY,
            [context.getHandler(), context.getClass()],
        )

        // Sem decorator ou marcado como skip → libera
        if (!options || options.skip) return true

        const request = context.switchToHttp().getRequest()
        const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown'
        const route = `${request.method}:${request.route?.path ?? request.path}`
        const key = `rl:${ip}:${route}`

        try {
            const pipeline = this.redis.pipeline()
            pipeline.incr(key)
            pipeline.ttl(key)
            const [[, count], [, ttlRemaining]] = await pipeline.exec() as [[null, number], [null, number]]

            // Primeira requisição nessa janela — define TTL
            if (ttlRemaining === -1) {
                await this.redis.expire(key, options.ttl)
            }

            if (count > options.limit) {
                const retryAfter = ttlRemaining > 0 ? ttlRemaining : options.ttl
                const message = (options.message ?? 'Muitas requisições. Aguarde {{ttl}} segundos.')
                    .replace('{{ttl}}', String(retryAfter))

                throw new HttpException(
                    { statusCode: 429, message, retryAfter },
                    HttpStatus.TOO_MANY_REQUESTS,
                )
            }
        } catch (err) {
            if (err instanceof HttpException) throw err
            // Se Redis estiver indisponível, libera a requisição e loga o erro
            this.logger.error('Rate limit Redis indisponível, liberando requisição', err)
        }

        return true
    }
}
