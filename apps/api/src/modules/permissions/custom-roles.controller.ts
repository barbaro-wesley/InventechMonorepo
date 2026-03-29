import {
  Controller, Get, Post, Patch, Delete, Put,
  Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { CustomRolesService } from './custom-roles.service'
import { Permission } from '../../common/decorators/permission.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import {
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
  SetCustomRolePermissionsDto,
  AssignCustomRoleDto,
} from './dto/permissions.dto'

@Controller('custom-roles')
export class CustomRolesController {
  constructor(private readonly customRolesService: CustomRolesService) {}

  /** Resolve o companyId efetivo. SUPER_ADMIN pode passar ?targetCompanyId= para agir em nome de uma empresa. */
  private resolveCompanyId(cu: AuthenticatedUser, targetCompanyId?: string): string {
    if (cu.role === UserRole.SUPER_ADMIN && targetCompanyId) return targetCompanyId
    if (cu.companyId) return cu.companyId
    throw new BadRequestException('Selecione uma empresa para gerenciar os papéis personalizados')
  }

  @Get()
  @Permission('custom-role:list')
  findAll(
    @CurrentUser() cu: AuthenticatedUser,
    @Query('targetCompanyId') targetCompanyId?: string,
  ) {
    return this.customRolesService.findAll(this.resolveCompanyId(cu, targetCompanyId))
  }

  @Get(':id')
  @Permission('custom-role:read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
    @Query('targetCompanyId') targetCompanyId?: string,
  ) {
    return this.customRolesService.findOne(id, this.resolveCompanyId(cu, targetCompanyId))
  }

  @Post()
  @Permission('custom-role:create')
  create(
    @Body() dto: CreateCustomRoleDto,
    @CurrentUser() cu: AuthenticatedUser,
    @Query('targetCompanyId') targetCompanyId?: string,
  ) {
    return this.customRolesService.create(this.resolveCompanyId(cu, targetCompanyId), dto)
  }

  @Patch(':id')
  @Permission('custom-role:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomRoleDto,
    @CurrentUser() cu: AuthenticatedUser,
    @Query('targetCompanyId') targetCompanyId?: string,
  ) {
    return this.customRolesService.update(id, this.resolveCompanyId(cu, targetCompanyId), dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('custom-role:delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
    @Query('targetCompanyId') targetCompanyId?: string,
  ) {
    return this.customRolesService.remove(id, this.resolveCompanyId(cu, targetCompanyId))
  }

  // ── Permissões do papel ────────────────────────────────────────────────────

  @Put(':id/permissions')
  @Permission('custom-role:update')
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomRolePermissionsDto,
    @CurrentUser() cu: AuthenticatedUser,
    @Query('targetCompanyId') targetCompanyId?: string,
  ) {
    return this.customRolesService.setPermissions(id, this.resolveCompanyId(cu, targetCompanyId), dto)
  }

  // ── Atribuição a usuário ───────────────────────────────────────────────────

  @Patch('assign/:userId')
  @Permission('custom-role:assign')
  assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignCustomRoleDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.customRolesService.assignToUser(userId, cu.companyId!, dto.customRoleId ?? null)
  }
}
