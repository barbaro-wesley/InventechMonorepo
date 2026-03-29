import { Module, Global } from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { PermissionsController } from './permissions.controller'
import { CustomRolesService } from './custom-roles.service'
import { CustomRolesController } from './custom-roles.controller'

// @Global() para que o PermissionsService esteja disponível no PermissionGuard
// sem precisar importar PermissionsModule em cada módulo
@Global()
@Module({
  controllers: [PermissionsController, CustomRolesController],
  providers: [PermissionsService, CustomRolesService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
