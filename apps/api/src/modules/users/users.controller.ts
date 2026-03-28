import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateOwnProfileDto, ChangePasswordDto } from './dto/update-own-profile.dto'
import { ListUsersDto } from './dto/list-users.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─────────────────────────────────────────
  // GET /users/profile — perfil do usuário logado
  // Qualquer papel autenticado pode acessar
  // ─────────────────────────────────────────
  @Get('profile')
  getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.getProfile(currentUser)
  }

  // ─────────────────────────────────────────
  // GET /users — listar usuários da empresa
  // ─────────────────────────────────────────
  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.COMPANY_MANAGER,
  )
  findAll(
    @Query() filters: ListUsersDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.findAll(currentUser, filters)
  }

  // ─────────────────────────────────────────
  // GET /users/:id — buscar usuário por ID
  // ─────────────────────────────────────────
  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.COMPANY_MANAGER,
  )
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.findOne(id, currentUser)
  }

  // ─────────────────────────────────────────
  // POST /users — criar usuário
  // ─────────────────────────────────────────
  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.COMPANY_MANAGER,
  )
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.create(dto, currentUser)
  }

  // ─────────────────────────────────────────
  // PATCH /users/profile — atualizar próprio perfil (nome, telefone, telegram)
  // DEVE ficar antes de PATCH :id para não ser capturado como parâmetro
  // ─────────────────────────────────────────
  @Patch('profile')
  updateOwnProfile(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.updateOwnProfile(dto, currentUser)
  }

  // ─────────────────────────────────────────
  // PATCH /users/profile/password — troca de senha com verificação da atual
  // ─────────────────────────────────────────
  @Patch('profile/password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.changePassword(dto, currentUser)
  }

  // ─────────────────────────────────────────
  // PATCH /users/:id — atualizar usuário
  // ─────────────────────────────────────────
  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.COMPANY_MANAGER,
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, currentUser)
  }

  // ─────────────────────────────────────────
  // DELETE /users/:id — remover usuário (soft delete)
  // ─────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.remove(id, currentUser)
  }
}