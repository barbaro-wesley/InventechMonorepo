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
    Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

interface RateLimitEntry {
    count: number
    resetAt: number
}

@Injectable()
export class RateLimitGuard implements CanActivate {
    // Chave: "<ip>:<rota>" → contagem de requisições
    private readonly store = new Map<string, RateLimitEntry>()

    constructor(private reflector: Reflector) {}

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
        const key = `${ip}:${route}`
        const now = Date.now()

        let entry = this.store.get(key)

        // Janela expirou → reseta
        if (!entry || now > entry.resetAt) {
            entry = { count: 1, resetAt: now + options.ttl * 1000 }
            this.store.set(key, entry)
            return true
        }

        entry.count++

        if (entry.count > options.limit) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
            const message = (options.message ?? 'Muitas requisições. Aguarde {{ttl}} segundos.')
                .replace('{{ttl}}', String(retryAfter))

            throw new HttpException(
                { statusCode: 429, message, retryAfter },
                HttpStatus.TOO_MANY_REQUESTS,
            )
        }

        return true
    }
}