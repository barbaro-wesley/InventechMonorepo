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
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateOwnProfileDto, ChangePasswordDto } from './dto/update-own-profile.dto'
import { ListUsersDto } from './dto/list-users.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Perfil próprio — qualquer autenticado (sem @Permission)
  @Get('profile')
  getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.getProfile(currentUser)
  }

  @Get()
  @Permission('user:list')
  findAll(
    @Query() filters: ListUsersDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.findAll(currentUser, filters)
  }

  @Get(':id')
  @Permission('user:read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.findOne(id, currentUser)
  }

  @Post()
  @Permission('user:create')
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.create(dto, currentUser)
  }

  // Atualizar próprio perfil — qualquer autenticado (sem @Permission)
  @Patch('profile')
  updateOwnProfile(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.updateOwnProfile(dto, currentUser)
  }

  // Troca de senha — qualquer autenticado (sem @Permission)
  @Patch('profile/password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.changePassword(dto, currentUser)
  }

  @Patch(':id')
  @Permission('user:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, currentUser)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('user:delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.remove(id, currentUser)
  }
}
