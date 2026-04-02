import { Injectable, Logger } from '@nestjs/common'
import { UserRole } from '@prisma/client'
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

  // Cache de permissões de system role: "tenantId:resource:action" → UserRole[]
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
    return this.checkSystemRole(user.role, user.tenantId, resource, action)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // System role: tenantId-level override → fallback para defaults
  // ─────────────────────────────────────────────────────────────────────────────

  async checkSystemRole(
    role: UserRole,
    tenantId: string | null,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const key = `${resource}:${action}`
    const allowedRoles = await this.getEffectiveSystemRoles(tenantId, resource, action)
    return allowedRoles.includes(role)
  }

  async getEffectiveSystemRoles(
    tenantId: string | null,
    resource: string,
    action: string,
  ): Promise<UserRole[]> {
    const permKey = `${resource}:${action}`

    if (tenantId) {
      const cacheKey = `${tenantId}:${permKey}`
      const cached = this.systemCache.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value
      }

      const override = await this.prisma.resourcePermission.findUnique({
        where: { tenantId_resource_action: { tenantId, resource, action } },
        select: { allowedRoles: true },
      })

      if (override?.allowedRoles?.length) {
        // Garante que os mínimos protegidos nunca sejam removidos
        const protected_ = PROTECTED_MINIMUMS[permKey] ?? []
        const merged = [...new Set([...override.allowedRoles as UserRole[], ...protected_])]

        this.systemCache.set(cacheKey, {
          value: merged,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
        return merged
      }

      // Sem override → usa default (também cacheado)
      const defaultRoles = DEFAULT_PERMISSIONS[permKey] ?? []
      this.systemCache.set(cacheKey, {
        value: defaultRoles,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      return defaultRoles
    }

    return DEFAULT_PERMISSIONS[permKey] ?? []
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

  invalidateCompanyCache(tenantId: string): void {
    for (const key of this.systemCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.systemCache.delete(key)
      }
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

  async findAllByCompany(tenantId: string) {
    return this.prisma.resourcePermission.findMany({
      where: { tenantId },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    })
  }

  async upsert(
    tenantId: string,
    resource: string,
    action: string,
    allowedRoles: string[],
  ) {
    const permKey = `${resource}:${action}`

    // Valida roles
    const valid = allowedRoles.filter((r) =>
      Object.values(UserRole).includes(r as UserRole),
    ) as UserRole[]

    // Força os mínimos protegidos
    const protected_ = PROTECTED_MINIMUMS[permKey] ?? []
    const merged = [...new Set([...valid, ...protected_])]

    const result = await this.prisma.resourcePermission.upsert({
      where: { tenantId_resource_action: { tenantId, resource, action } },
      create: { tenantId, resource, action, allowedRoles: merged },
      update: { allowedRoles: merged },
    })

    this.invalidateCompanyCache(tenantId)
    return result
  }

  async remove(tenantId: string, resource: string, action: string) {
    const existing = await this.prisma.resourcePermission.findUnique({
      where: { tenantId_resource_action: { tenantId, resource, action } },
    })
    if (!existing) return { message: 'Override não encontrado — já usa o padrão' }

    await this.prisma.resourcePermission.delete({
      where: { tenantId_resource_action: { tenantId, resource, action } },
    })

    this.invalidateCompanyCache(tenantId)
    return { message: `Override de ${resource}:${action} removido — voltou ao padrão` }
  }

  async reset(tenantId: string) {
    await this.prisma.resourcePermission.deleteMany({ where: { tenantId } })
    this.invalidateCompanyCache(tenantId)
    return { message: 'Todas as permissões restauradas para os padrões do sistema' }
  }
}
