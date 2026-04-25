import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'
import { PERMISSION_KEY } from '../decorators/permission.decorator'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { PermissionsService } from '../../modules/permissions/permissions.service'
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user: AuthenticatedUser = request.user

    // Endpoint público ou sem usuário autenticado — JwtAuthGuard cuida disso
    if (!user) return true

    // SUPER_ADMIN tem acesso irrestrito a tudo
    if (user.role === UserRole.SUPER_ADMIN) return true

    // ── Verifica @Permission('resource:action') ──────────────────────────────
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (permission) {
      const [resource, action] = permission.split(':')
      const allowed = await this.permissionsService.checkAccess(user, resource, action)

      if (!allowed) {
        throw new ForbiddenException('Acesso negado.')
      }
      return true
    }

    // ── Fallback: suporta @Roles(...) legado ─────────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (requiredRoles?.length) {
      const hasRole = requiredRoles.includes(user.role)
      if (!hasRole) {
        throw new ForbiddenException('Acesso negado.')
      }
    }

    return true
  }
}
