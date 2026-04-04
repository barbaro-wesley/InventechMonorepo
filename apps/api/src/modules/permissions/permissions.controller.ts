import {
  Controller, Get, Post, Delete, Patch, Body, HttpCode, HttpStatus,
} from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { Permission } from '../../common/decorators/permission.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { UpsertResourcePermissionDto, RemoveResourcePermissionDto } from './dto/permissions.dto'
import { DEFAULT_PERMISSIONS, RESOURCE_ACTIONS } from './permissions.defaults'

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ── Matriz de defaults do sistema (read-only, para a UI renderizar) ─────────

  @Get('defaults')
  @Permission('permission:read')
  getDefaults() {
    return {
      permissions: DEFAULT_PERMISSIONS,
      resources: RESOURCE_ACTIONS,
    }
  }

  // ── Overrides da empresa ────────────────────────────────────────────────────

  @Get()
  @Permission('permission:read')
  findAll(@CurrentUser() cu: AuthenticatedUser) {
    if (!cu.companyId) return []
    return this.permissionsService.findAllByCompany(cu.companyId)
  }

  // Retorna a matriz completa efetiva (defaults + overrides mesclados) para a UI
  @Get('matrix')
  @Permission('permission:read')
  async getMatrix(@CurrentUser() cu: AuthenticatedUser) {
    // SA (companyId = null) → busca overrides globais
    // CA/outros → busca overrides da empresa (com fallback nos globais)
    const overrides = await this.permissionsService.findAllByCompany(cu.companyId ?? null)
    const overrideMap = new Map(overrides.map((o) => [`${o.resource}:${o.action}`, o.allowedRoles]))

    const matrix = Object.entries(DEFAULT_PERMISSIONS).map(([key, defaultRoles]) => {
      const [resource, ...rest] = key.split(':')
      const action = rest.join(':')
      const override = overrideMap.get(key)
      return {
        resource,
        action,
        defaultRoles,
        effectiveRoles: override ?? defaultRoles,
        isOverridden: !!override,
      }
    })

    return { matrix, resources: RESOURCE_ACTIONS }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Permission('permission:manage')
  upsert(
    @Body() dto: UpsertResourcePermissionDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.permissionsService.upsert(cu.companyId ?? null, dto.resource, dto.action, dto.allowedRoles)
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @Permission('permission:manage')
  remove(
    @Body() dto: RemoveResourcePermissionDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.permissionsService.remove(cu.companyId ?? null, dto.resource, dto.action)
  }

  @Patch('reset')
  @HttpCode(HttpStatus.OK)
  @Permission('permission:manage')
  reset(@CurrentUser() cu: AuthenticatedUser) {
    return this.permissionsService.reset(cu.companyId ?? null)
  }
}
