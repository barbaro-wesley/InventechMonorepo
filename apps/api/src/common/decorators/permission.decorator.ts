import { SetMetadata } from '@nestjs/common'

export const PERMISSION_KEY = 'permission'

/**
 * Declara qual permissão (resource:action) é exigida pelo endpoint.
 * O PermissionGuard resolve se o usuário (system role ou custom role) tem acesso.
 *
 * Exemplos:
 *   @Permission('equipment:create')
 *   @Permission('service-order:update-status')
 */
export const Permission = (permission: string) => SetMetadata(PERMISSION_KEY, permission)
