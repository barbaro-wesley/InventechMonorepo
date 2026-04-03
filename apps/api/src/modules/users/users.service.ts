import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'
import { UserRole, UserStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { UsersRepository } from './users.repository'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateOwnProfileDto, ChangePasswordDto } from './dto/update-own-profile.dto'
import { ListUsersDto } from './dto/list-users.dto'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { TwoFactorService } from '../auth/security/two-factor.service'
import { PrismaService } from '../../prisma/prisma.service'

const COMPANY_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_MANAGER,
  UserRole.TECHNICIAN,
]

const CLIENT_ROLES = [
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_USER,
  UserRole.CLIENT_VIEWER,
]

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private twoFactorService: TwoFactorService,
    private prisma: PrismaService,
  ) { }

  async findAll(currentUser: AuthenticatedUser, filters: ListUsersDto) {
    this.ensureCompanyScope(currentUser)
    // SUPER_ADMIN pode filtrar por empresa via query param
    const companyId = currentUser.role === UserRole.SUPER_ADMIN
      ? (filters.companyId ?? undefined)
      : currentUser.companyId!
    // CLIENT_ADMIN vê apenas usuários do seu próprio cliente
    const effectiveFilters = currentUser.clientId
      ? { ...filters, clientId: currentUser.clientId }
      : filters
    return this.usersRepository.findMany(companyId, effectiveFilters)
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    this.ensureCompanyScope(currentUser)
    const companyScope = currentUser.role === UserRole.SUPER_ADMIN ? undefined : currentUser.companyId!
    const user = await this.usersRepository.findById(id, companyScope)
    if (!user) throw new NotFoundException('Usuário não encontrado')
    return user
  }

  // ─────────────────────────────────────────
  // ✅ CORRIGIDO — cria com UNVERIFIED e envia email de verificação
  // ─────────────────────────────────────────
  async create(dto: CreateUserDto, currentUser: AuthenticatedUser) {
    this.ensureCompanyScope(currentUser)
    this.validateRolePermission(dto.role, currentUser)

    const emailTaken = await this.usersRepository.emailExists(dto.email)
    if (emailTaken) throw new ConflictException('Este email já está em uso')

    const { companyId, clientId } = this.resolveTenantIds(dto, currentUser)

    if ((CLIENT_ROLES as UserRole[]).includes(dto.role) && !clientId) {
      throw new BadRequestException('clientId é obrigatório para usuários do tipo cliente')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    // ✅ Cria com status UNVERIFIED — não pode logar antes de verificar o email
    const user = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      status: UserStatus.UNVERIFIED,  // ← era ACTIVE antes
      phone: dto.phone,
      telegramChatId: dto.telegramChatId,
      company: companyId ? { connect: { id: companyId } } : undefined,
      client: clientId ? { connect: { id: clientId } } : undefined,
      ...(dto.customRoleId && { customRole: { connect: { id: dto.customRoleId } } }),
    })

    // ✅ Envia email de verificação automaticamente
    try {
      await this.twoFactorService.sendEmailVerification(user.id)
    } catch (error) {
      // Não falha o cadastro se o email não chegar — o usuário pode solicitar reenvio
    }

    return user
  }

  async update(id: string, dto: UpdateUserDto, currentUser: AuthenticatedUser) {
    this.ensureCompanyScope(currentUser)

    const companyScope = currentUser.role === UserRole.SUPER_ADMIN ? undefined : currentUser.companyId!
    const existing = await this.usersRepository.findById(id, companyScope)
    if (!existing) throw new NotFoundException('Usuário não encontrado')

    this.validateRoleHierarchy(existing.role as UserRole, currentUser)

    if (dto.role) {
      this.validateRolePermission(dto.role, currentUser)
    }

    const data: Record<string, any> = {
      ...(dto.name && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.telegramChatId !== undefined && { telegramChatId: dto.telegramChatId }),
      ...(dto.status && { status: dto.status }),
      ...(dto.role && { role: dto.role }),
      ...(dto.customRoleId !== undefined && { customRoleId: dto.customRoleId }),
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10)
    }

    return this.usersRepository.update(id, data)
  }

  async remove(id: string, currentUser: AuthenticatedUser) {
    this.ensureCompanyScope(currentUser)

    if (id === currentUser.sub) {
      throw new ForbiddenException('Você não pode remover sua própria conta')
    }

    const companyScope = currentUser.role === UserRole.SUPER_ADMIN ? undefined : currentUser.companyId!
    const existing = await this.usersRepository.findById(id, companyScope)
    if (!existing) throw new NotFoundException('Usuário não encontrado')

    this.validateRoleHierarchy(existing.role as UserRole, currentUser)

    await this.usersRepository.softDelete(id)
    return { message: 'Usuário removido com sucesso' }
  }

  // ─────────────────────────────────────────
  // Atualiza o próprio perfil (sem verificação de hierarquia)
  // ─────────────────────────────────────────
  async updateOwnProfile(dto: UpdateOwnProfileDto, currentUser: AuthenticatedUser) {
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.phone !== undefined) data.phone = dto.phone || null
    if (dto.telegramChatId !== undefined) data.telegramChatId = dto.telegramChatId || null

    return this.prisma.user.update({
      where: { id: currentUser.sub },
      data,
      select: {
        id: true, name: true, email: true, role: true, status: true,
        avatarUrl: true, phone: true, telegramChatId: true,
        companyId: true, clientId: true,
      },
    })
  }

  // ─────────────────────────────────────────
  // Troca de senha autenticada
  // Valida a senha atual antes de trocar
  // ─────────────────────────────────────────
  async changePassword(dto: ChangePasswordDto, currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: { passwordHash: true },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash)
    if (!isCurrentValid) {
      throw new UnauthorizedException('Senha atual incorreta')
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10)
    await this.prisma.user.update({
      where: { id: currentUser.sub },
      data: { passwordHash: newHash },
    })

    return { message: 'Senha alterada com sucesso' }
  }

  async getProfile(currentUser: AuthenticatedUser) {
    const user = await this.usersRepository.findByEmail(currentUser.email)
    if (!user) throw new NotFoundException('Usuário não encontrado')
    const { passwordHash, ...safeUser } = user as any
    return safeUser
  }

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────
  private ensureCompanyScope(user: AuthenticatedUser) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.companyId) {
      throw new ForbiddenException('Acesso sem escopo de empresa')
    }
  }

  private validateRolePermission(role: UserRole, currentUser: AuthenticatedUser) {
    const { role: currentRole } = currentUser
    if (currentRole === UserRole.SUPER_ADMIN) return
    if (currentRole === UserRole.COMPANY_ADMIN && role !== UserRole.SUPER_ADMIN) return
    if (
      currentRole === UserRole.COMPANY_MANAGER &&
      ([...CLIENT_ROLES, UserRole.TECHNICIAN] as UserRole[]).includes(role)
    ) return
    // CLIENT_ADMIN pode criar CLIENT_USER e CLIENT_VIEWER dentro do seu próprio cliente
    if (
      currentRole === UserRole.CLIENT_ADMIN &&
      ([UserRole.CLIENT_USER, UserRole.CLIENT_VIEWER] as UserRole[]).includes(role)
    ) return
    throw new ForbiddenException(`Você não tem permissão para criar usuários com o papel: ${role}`)
  }

  private validateRoleHierarchy(targetRole: UserRole, currentUser: AuthenticatedUser) {
    const hierarchy: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 100,
      [UserRole.COMPANY_ADMIN]: 80,
      [UserRole.COMPANY_MANAGER]: 60,
      [UserRole.TECHNICIAN]: 40,
      [UserRole.CLIENT_ADMIN]: 30,
      [UserRole.CLIENT_USER]: 20,
      [UserRole.CLIENT_VIEWER]: 10,
    }
    if (hierarchy[targetRole] >= hierarchy[currentUser.role]) {
      throw new ForbiddenException('Você não pode editar um usuário com papel igual ou superior ao seu')
    }
  }

  private resolveTenantIds(dto: CreateUserDto, currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return { companyId: dto.companyId ?? null, clientId: dto.clientId ?? null }
    }
    const companyId = currentUser.companyId!
    const clientId = dto.clientId ?? ((CLIENT_ROLES as UserRole[]).includes(dto.role) ? currentUser.clientId : null)
    return { companyId, clientId }
  }
}