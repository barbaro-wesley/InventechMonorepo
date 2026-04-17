import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../prisma/prisma.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { REDIS_CLIENT } from '../providers/redis.provider'

const LICENSE_CACHE_TTL = 120 // 2 minutos

interface LicenseCacheEntry {
  status: string
  licenseExpiresAt: string | null
  trialEndsAt: string | null
  suspendedReason: string | null
}

@Injectable()
export class CompanyLicenseGuard implements CanActivate {
  private readonly logger = new Logger(CompanyLicenseGuard.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // ── 1. Rota pública → passa sempre ───────────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    // ── 2. Sem usuário → JwtAuthGuard vai rejeitar ────────────────
    const user = request.user
    if (!user?.sub) return true

    // ── 3. SUPER_ADMIN → nunca bloqueado ─────────────────────────
    if (user.role === UserRole.SUPER_ADMIN) return true

    // ── 4. Sem companyId → nada a verificar ──────────────────────
    const companyId = user.companyId
    if (!companyId) return true

    // ── 5. Busca status da empresa (com cache Redis) ──────────────
    const company = await this.fetchCompanyStatus(companyId)
    if (!company) return true

    const now = new Date()

    // ── 6. Verificações de bloqueio ───────────────────────────────
    if (company.status === 'SUSPENDED') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'CompanySuspended',
        message: 'O acesso desta empresa está suspenso. Entre em contato com o suporte.',
        code: 'COMPANY_SUSPENDED',
        reason: company.suspendedReason,
      })
    }

    if (company.status === 'INACTIVE') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'CompanyInactive',
        message: 'Esta empresa está inativa. Entre em contato com o suporte.',
        code: 'COMPANY_INACTIVE',
      })
    }

    if (company.licenseExpiresAt && new Date(company.licenseExpiresAt) < now) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'LicenseExpired',
        message: `A licença desta empresa venceu em ${new Date(company.licenseExpiresAt).toLocaleDateString('pt-BR')}. Renove para continuar usando o sistema.`,
        code: 'LICENSE_EXPIRED',
        expiredAt: company.licenseExpiresAt,
      })
    }

    if (company.status === 'TRIAL' && company.trialEndsAt && new Date(company.trialEndsAt) < now) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'TrialExpired',
        message: `O período de teste encerrou em ${new Date(company.trialEndsAt).toLocaleDateString('pt-BR')}. Contrate um plano para continuar.`,
        code: 'TRIAL_EXPIRED',
        expiredAt: company.trialEndsAt,
      })
    }

    return true
  }

  private async fetchCompanyStatus(companyId: string): Promise<LicenseCacheEntry | null> {
    const cacheKey = `license:${companyId}`

    try {
      const cached = await this.redis.get(cacheKey)
      if (cached) return JSON.parse(cached) as LicenseCacheEntry
    } catch {
      // Redis indisponível — continua para busca no banco
    }

    try {
      const company = await this.prisma.$queryRaw<Array<{
        status: string
        license_expires_at: Date | null
        trial_ends_at: Date | null
        suspended_reason: string | null
      }>>`
        SELECT status, license_expires_at, trial_ends_at, suspended_reason
        FROM companies
        WHERE id = ${companyId}
        AND deleted_at IS NULL
        LIMIT 1
      `

      if (!company.length) return null

      const row = company[0]
      const data: LicenseCacheEntry = {
        status: row.status,
        licenseExpiresAt: row.license_expires_at?.toISOString() ?? null,
        trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
        suspendedReason: row.suspended_reason,
      }

      try {
        await this.redis.setex(cacheKey, LICENSE_CACHE_TTL, JSON.stringify(data))
      } catch {
        // Falha ao gravar cache não é crítica
      }

      return data
    } catch (err) {
      this.logger.error(`Erro ao verificar licença da empresa ${companyId}: ${err.message}`)
      return null // fail open — não bloqueia se o banco falhar
    }
  }
}
