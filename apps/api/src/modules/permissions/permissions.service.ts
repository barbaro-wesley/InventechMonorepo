import { Injectable, Logger, Inject } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'
import type Redis from 'ioredis'
import { PrismaService } from '../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../common/providers/redis.provider'
import {
  DEFAULT_PERMISSIONS,
  PROTECTED_MINIMUMS,
} from './permissions.defaults'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

const CACHE_TTL_SEC = 5 * 60 // 5 minutos
const KEY_PREFIX = 'manutencao:' // espelha o keyPrefix do ioredis

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
      const cached = await this.redis.get(redisKey)
      if (cached !== null) return JSON.parse(cached) as UserRole[] | null

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

      // Armazena null explicitamente para evitar cache miss repetido
      await this.redis.set(redisKey, JSON.stringify(value), 'EX', CACHE_TTL_SEC)
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

    const defaultRoles = DEFAULT_PERMISSIONS[permKey] ?? []
    const cacheKey = `perm:sys:${companyId ?? '__global__'}:${permKey}`
    await this.redis.set(cacheKey, JSON.stringify(defaultRoles), 'EX', CACHE_TTL_SEC)
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
    const redisKey = `perm:cust:${customRoleId}:${resource}:${action}`
    const cached = await this.redis.get(redisKey)
    if (cached !== null) return cached === '1'

    const perm = await this.prisma.customRolePermission.findUnique({
      where: { customRoleId_resource_action: { customRoleId, resource, action } },
    })

    const allowed = !!perm
    await this.redis.set(redisKey, allowed ? '1' : '0', 'EX', CACHE_TTL_SEC)
    return allowed
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Invalidação de cache — chamada após write operations
  // Usa SCAN para remover chaves por prefixo sem bloquear o Redis
  // ─────────────────────────────────────────────────────────────────────────────

  async invalidateCompanyCache(companyId: string | null): Promise<void> {
    await this.scanAndDelete(`perm:sys:${companyId ?? '__global__'}:*`)
  }

  async invalidateCustomRoleCache(customRoleId: string): Promise<void> {
    await this.scanAndDelete(`perm:cust:${customRoleId}:*`)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Percorre via SCAN e apaga chaves que casam o padrão.
  // O KEY_PREFIX precisa estar no padrão porque o SCAN não usa o keyPrefix do ioredis.
  // ─────────────────────────────────────────────────────────────────────────────
  private async scanAndDelete(pattern: string): Promise<void> {
    const fullPattern = `${KEY_PREFIX}${pattern}`
    let cursor = '0'
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100)
      cursor = next
      if (keys.length > 0) {
        // Remove o prefixo antes do DEL porque o ioredis o adiciona automaticamente
        await this.redis.del(...keys.map((k) => k.slice(KEY_PREFIX.length)))
      }
    } while (cursor !== '0')
  }
}
