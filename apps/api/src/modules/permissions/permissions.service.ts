import { Injectable, Logger, Inject } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../prisma/prisma.service'
import {
  DEFAULT_PERMISSIONS,
  PROTECTED_MINIMUMS,
} from './permissions.defaults'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { REDIS_CLIENT } from '../../common/providers/redis.provider'

const PERM_TTL = 300 // 5 minutos
const KEY_PREFIX = 'manutencao:' // mesmo keyPrefix do redis.provider

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Ponto de entrada principal — chamado pelo PermissionGuard
  // ─────────────────────────────────────────────────────────────────────────────

  async checkAccess(
    user: AuthenticatedUser,
    resource: string,
    action: string,
  ): Promise<boolean> {
    if (user.customRoleId) {
      return this.checkCustomRole(user.customRoleId, resource, action)
    }
    return this.checkSystemRole(user.role, user.companyId, resource, action)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // System role: companyId-level override → fallback para defaults
  // ─────────────────────────────────────────────────────────────────────────────

  async checkSystemRole(
    role: UserRole,
    companyId: string | null,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const allowedRoles = await this.getEffectiveSystemRoles(companyId, resource, action)
    return allowedRoles.includes(role)
  }

  async getEffectiveSystemRoles(
    companyId: string | null,
    resource: string,
    action: string,
  ): Promise<UserRole[]> {
    const permKey = `${resource}:${action}`
    const protected_ = PROTECTED_MINIMUMS[permKey] ?? []

    const applyProtected = (roles: UserRole[]) =>
      [...new Set([...roles, ...protected_])]

    const fetchOverride = async (cid: string | null) => {
      const redisKey = `perm:sys:${cid ?? '__global__'}:${permKey}`

      try {
        const cached = await this.redis.get(redisKey)
        if (cached) return JSON.parse(cached) as UserRole[]
      } catch {
        // Redis indisponível — busca no banco
      }

      const override = cid
        ? await this.prisma.resourcePermission.findUnique({
            where: { companyId_resource_action: { companyId: cid, resource, action } },
            select: { allowedRoles: true },
          })
        : await this.prisma.resourcePermission.findFirst({
            where: { companyId: null, resource, action } as Prisma.ResourcePermissionWhereInput,
            select: { allowedRoles: true },
          })

      const value = override?.allowedRoles?.length
        ? applyProtected(override.allowedRoles as UserRole[])
        : null

      if (value) {
        try {
          await this.redis.setex(redisKey, PERM_TTL, JSON.stringify(value))
        } catch {
          // Falha ao gravar cache não é crítica
        }
      }
      return value
    }

    if (companyId) {
      const companyOverride = await fetchOverride(companyId)
      if (companyOverride) return companyOverride

      const globalOverride = await fetchOverride(null)
      if (globalOverride) return globalOverride
    } else {
      const globalOverride = await fetchOverride(null)
      if (globalOverride) return globalOverride
    }

    // Default em código — persiste no Redis para evitar query na próxima vez
    const defaultRoles = DEFAULT_PERMISSIONS[permKey] ?? []
    const redisKey = `perm:sys:${companyId ?? '__global__'}:${permKey}`
    try {
      await this.redis.setex(redisKey, PERM_TTL, JSON.stringify(defaultRoles))
    } catch {
      // Não crítico
    }
    return defaultRoles
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom role: whitelist explícita de resource:action
  // ─────────────────────────────────────────────────────────────────────────────

  async checkCustomRole(
    customRoleId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const redisKey = `perm:custom:${customRoleId}:${resource}:${action}`

    try {
      const cached = await this.redis.get(redisKey)
      if (cached !== null) return cached === '1'
    } catch {
      // Redis indisponível — busca no banco
    }

    const perm = await this.prisma.customRolePermission.findUnique({
      where: { customRoleId_resource_action: { customRoleId, resource, action } },
    })

    const allowed = !!perm
    try {
      await this.redis.setex(redisKey, PERM_TTL, allowed ? '1' : '0')
    } catch {
      // Não crítico
    }
    return allowed
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Invalidação de cache — chamada após write operations
  // Usa SCAN para não bloquear o Redis com KEYS em produção
  // ─────────────────────────────────────────────────────────────────────────────

  async invalidateCompanyCache(companyId: string | null): Promise<void> {
    const pattern = `${KEY_PREFIX}perm:sys:${companyId ?? '__global__'}:*`
    await this.scanAndDelete(pattern)
  }

  async invalidateCustomRoleCache(customRoleId: string): Promise<void> {
    const pattern = `${KEY_PREFIX}perm:custom:${customRoleId}:*`
    await this.scanAndDelete(pattern)
  }

  private async scanAndDelete(pattern: string): Promise<void> {
    try {
      let cursor = '0'
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = next
        if (keys.length > 0) {
          // ioredis re-adiciona o keyPrefix em DEL, então removemos o prefix dos resultados do SCAN
          const stripped = keys.map(k =>
            k.startsWith(KEY_PREFIX) ? k.slice(KEY_PREFIX.length) : k,
          )
          await this.redis.del(...stripped)
        }
      } while (cursor !== '0')
    } catch (err) {
      this.logger.warn(`Falha ao invalidar cache Redis (${pattern}): ${err.message}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers para o PermissionsController
  // ─────────────────────────────────────────────────────────────────────────────

  async findAllByCompany(companyId: string | null) {
    return this.prisma.resourcePermission.findMany({
      where: { companyId } as Prisma.ResourcePermissionWhereInput,
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    })
  }

  async upsert(
    companyId: string | null,
    resource: string,
    action: string,
    allowedRoles: string[],
  ) {
    const permKey = `${resource}:${action}`

    const valid = allowedRoles.filter((r) =>
      Object.values(UserRole).includes(r as UserRole),
    ) as UserRole[]

    const protected_ = PROTECTED_MINIMUMS[permKey] ?? []
    const merged = [...new Set([...valid, ...protected_])]

    let result: Awaited<ReturnType<typeof this.prisma.resourcePermission.create>>

    if (companyId) {
      result = await this.prisma.resourcePermission.upsert({
        where: { companyId_resource_action: { companyId, resource, action } },
        create: { companyId, resource, action, allowedRoles: merged },
        update: { allowedRoles: merged },
      })
    } else {
      const existing = await this.prisma.resourcePermission.findFirst({
        where: { companyId: null, resource, action } as Prisma.ResourcePermissionWhereInput,
      })
      result = existing
        ? await this.prisma.resourcePermission.update({
            where: { id: existing.id },
            data: { allowedRoles: merged },
          })
        : await this.prisma.resourcePermission.create({
            data: { companyId: null, resource, action, allowedRoles: merged },
          })
    }

    await this.invalidateCompanyCache(companyId)
    return result
  }

  async remove(companyId: string | null, resource: string, action: string) {
    const existing = companyId
      ? await this.prisma.resourcePermission.findUnique({
          where: { companyId_resource_action: { companyId, resource, action } },
        })
      : await this.prisma.resourcePermission.findFirst({
          where: { companyId: null, resource, action } as Prisma.ResourcePermissionWhereInput,
        })

    if (!existing) return { message: 'Override não encontrado — já usa o padrão' }

    await this.prisma.resourcePermission.delete({ where: { id: existing.id } })

    await this.invalidateCompanyCache(companyId)
    return { message: `Override de ${resource}:${action} removido — voltou ao padrão` }
  }

  async reset(companyId: string | null) {
    await this.prisma.resourcePermission.deleteMany({
      where: { companyId } as Prisma.ResourcePermissionWhereInput,
    })
    await this.invalidateCompanyCache(companyId)
    return { message: 'Todas as permissões restauradas para os padrões do sistema' }
  }
}
