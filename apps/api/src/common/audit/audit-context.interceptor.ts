import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import { Observable } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface'
import { getClientIp } from '../utils/request.util'
import { AuditContext, auditStorage } from './audit-context'

// ─────────────────────────────────────────────────────────────────────────────
// Abre o contexto de auditoria de cada requisição HTTP.
//
// Roda depois dos guards, então request.user (JWT) já está preenchido.
// Os logs gerados pela extensão Prisma ficam em buffer e só são gravados se o
// handler terminar com sucesso — em erro (ex.: rollback de transação) são
// descartados, para não registrar algo que não aconteceu.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
    constructor(private readonly prisma: PrismaService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') return next.handle()

        const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
        const user = req.user
        const headerId = req.headers['x-request-id']
        const route = (req.route as { path?: string } | undefined)?.path ?? req.path

        const ctx: AuditContext = {
            userId: user?.sub ?? null,
            userEmail: user?.email ?? null,
            companyId: user?.companyId ?? null,
            ipAddress: getClientIp(req) || null,
            userAgent: (req.headers['user-agent'] as string) ?? null,
            requestId: (Array.isArray(headerId) ? headerId[0] : headerId) ?? randomUUID(),
            method: `${req.method} ${route}`,
            buffer: [],
            flushed: false,
        }

        const flush = () => {
            if (ctx.flushed) return
            ctx.flushed = true
            const entries = ctx.buffer.splice(0)
            void this.prisma.flushAuditEntries(entries)
        }

        return new Observable((subscriber) =>
            auditStorage.run(ctx, () =>
                next.handle().subscribe({
                    next: (value) => {
                        flush()
                        subscriber.next(value)
                    },
                    error: (err) => {
                        // Requisição falhou: descarta o que foi acumulado
                        ctx.buffer.length = 0
                        ctx.flushed = true
                        subscriber.error(err)
                    },
                    complete: () => {
                        flush()
                        subscriber.complete()
                    },
                }),
            ),
        )
    }
}
