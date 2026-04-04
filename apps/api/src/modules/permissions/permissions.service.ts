import { Injectable, Logger } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  DEFAULT_PERMISSIONS,
  PROTECTED_MINIMUMS,
} from './permissions.defaults'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

// ─────────────────────────────────────────────────────────────────────────────
// Cache in-memory com TTL
// Evita consulta ao banco em toda requisição
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name)

  // Cache de permissões de system role: "companyId:resource:action" → UserRole[]
  private readonly systemCache = new Map<string, CacheEntry<UserRole[]>>()

  // Cache de custom role: "customRoleId:resource:action" → boolean
  private readonly customCache = new Map<string, CacheEntry<boolean>>()

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Ponto de entrada principal — chamado pelo PermissionGuard
  // ─────────────────────────────────────────────────────────────────────────────

  async checkAccess(
    user: AuthenticatedUser,
    resource: string,
    action: string,
  ): Promise<boolean> {
    // Usuário com custom role → verificação por permissões explícitas
    if (user.customRoleId) {
      return this.checkCustomRole(user.customRoleId, resource, action)
    }

    // System role → verifica overrides da empresa ou defaults
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
    const key = `${resource}:${action}`
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

    // Helper: busca override no banco (funciona com companyId null = global)
    const fetchOverride = async (cid: string | null) => {
      const cacheKey = `${cid ?? '__global__'}:${permKey}`
      const cached = this.systemCache.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) return cached.value

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
        this.systemCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS })
      }
      return value
    }

    if (companyId) {
      // 1. Override da empresa
      const companyOverride = await fetchOverride(companyId)
      if (companyOverride) return companyOverride

      // 2. Override global (null)
      const globalOverride = await fetchOverride(null)
      if (globalOverride) return globalOverride
    } else {
      // SA sem empresa: verifica override global
      const globalOverride = await fetchOverride(null)
      if (globalOverride) return globalOverride
    }

    // 3. Default em código
    const defaultRoles = DEFAULT_PERMISSIONS[permKey] ?? []
    const cacheKey = `${companyId ?? '__global__'}:${permKey}`
    this.systemCache.set(cacheKey, {
      value: defaultRoles,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
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
    const cacheKey = `customRole:${customRoleId}:${resource}:${action}`
    const cached = this.customCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const perm = await this.prisma.customRolePermission.findUnique({
      where: { customRoleId_resource_action: { customRoleId, resource, action } },
    })

    const allowed = !!perm
    this.customCache.set(cacheKey, {
      value: allowed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return allowed
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Invalidação de cache — chamada após write operations
  // ─────────────────────────────────────────────────────────────────────────────

  invalidateCompanyCache(companyId: string | null): void {
    const prefix = `${companyId ?? '__global__'}:`
    for (const key of this.systemCache.keys()) {
      if (key.startsWith(prefix)) this.systemCache.delete(key)
    }
  }

  invalidateCustomRoleCache(customRoleId: string): void {
    for (const key of this.customCache.keys()) {
      if (key.startsWith(`customRole:${customRoleId}:`)) {
        this.customCache.delete(key)
      }
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
      // global (null): upsert manual pois compound unique não suporta null no Prisma
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

    this.invalidateCompanyCache(companyId)
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

    this.invalidateCompanyCache(companyId)
    return { message: `Override de ${resource}:${action} removido — voltou ao padrão` }
  }

  async reset(companyId: string | null) {
    await this.prisma.resourcePermission.deleteMany({
      where: { companyId } as Prisma.ResourcePermissionWhereInput,
    })
    this.invalidateCompanyCache(companyId)
    return { message: 'Todas as permissões restauradas para os padrões do sistema' }
  }
}
