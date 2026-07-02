import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Logger,
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
import { NotificationsService } from '../notifications/notifications.service'
import { EventType } from '../notifications/notifications.constants'
import { getDefaultFirstAccessPasswordHash, getSecuritySettings } from '../companies/company-security-settings'
import { DEFAULT_SECURITY_SETTINGS } from '@inventech/shared-types'

const COMPANY_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_MANAGER,
  UserRole.TECHNICIAN,
]

const CLIENT_ROLES = [
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_USER,
  UserRole.CLIENT_VIEWER,
  UserRole.MEMBER,
]

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private usersRepository: UsersRepository,
    private twoFactorService: TwoFactorService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
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

    if (!dto.role && !dto.customRoleId) {
      throw new BadRequestException('Informe o papel de sistema ou um papel personalizado')
    }

    // Quando só customRoleId é fornecido (sem role de sistema), usamos MEMBER como
    // papel base no banco mas pulamos validações exclusivas de papéis de cliente.
    const isCustomRoleOnly = !dto.role && !!dto.customRoleId
    const role = dto.role ?? UserRole.MEMBER

    if (!isCustomRoleOnly) {
      this.validateRolePermission(role, currentUser)
    }

    const emailTaken = await this.usersRepository.emailExists(dto.email)
    if (emailTaken) throw new ConflictException('Este email já está em uso')

    const { companyId, clientId } = this.resolveTenantIds({ ...dto, role }, currentUser, isCustomRoleOnly)

    if (!isCustomRoleOnly && (CLIENT_ROLES as UserRole[]).includes(role) && !clientId) {
      throw new BadRequestException('clientId é obrigatório para usuários do tipo cliente')
    }

    // Parâmetros de segurança configuráveis por empresa
    const security = await this.loadSecuritySettings(companyId)

    let passwordHash: string
    let mustChangePassword: boolean
    if (dto.password) {
      await this.assertPasswordLength(dto.password, companyId)
      passwordHash = await bcrypt.hash(dto.password, 10)
      mustChangePassword = security.forcePasswordChangeOnFirstLogin
    } else {
      // Sem senha informada — herda a senha padrão de primeiro acesso da empresa.
      // Uma senha compartilhada nunca pode ficar ativa sem troca obrigatória.
      const defaultHash = await this.loadDefaultFirstAccessPasswordHash(companyId)
      if (!defaultHash) {
        throw new BadRequestException(
          'Informe uma senha ou configure a senha padrão de primeiro acesso da empresa em Configurações > Segurança',
        )
      }
      passwordHash = defaultHash
      mustChangePassword = true
    }

    // Status inicial conforme a política de verificação de email da empresa
    const user = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role,
      status: security.requireEmailVerification ? UserStatus.UNVERIFIED : UserStatus.ACTIVE,
      mustChangePassword,
      phone: dto.phone,
      telegramChatId: dto.telegramChatId,
      company: companyId ? { connect: { id: companyId } } : undefined,
      client: clientId ? { connect: { id: clientId } } : undefined,
      ...(dto.customRoleId && { customRole: { connect: { id: dto.customRoleId } } }),
    })

    // Envia email de verificação somente se a política exigir
    if (security.requireEmailVerification) {
      try {
        await this.twoFactorService.sendEmailVerification(user.id)
      } catch (error) {
        // Não falha o cadastro se o email não chegar — o usuário pode solicitar reenvio
      }
    }

    // Dispara evento para regras de alerta dinâmicas
    if (companyId) {
      this.notificationsService.notify({
        event: EventType.USER_CREATED,
        companyId,
        data: {
          userName:  user.name,
          userEmail: user.email,
          userRole:  user.role,
        },
      }).catch(() => { /* ignora falha — não bloqueia o cadastro */ })
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

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.usersRepository.emailExists(dto.email)
      if (emailTaken) throw new ConflictException('Este email já está em uso')
    }

    const data: Record<string, any> = {
      ...(dto.name && { name: dto.name }),
      ...(dto.email && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.telegramChatId !== undefined && { telegramChatId: dto.telegramChatId }),
      ...(dto.status && { status: dto.status }),
      ...(dto.role && { role: dto.role }),
      ...(dto.customRoleId !== undefined && { customRoleId: dto.customRoleId }),
    }

    if (dto.password) {
      await this.assertPasswordLength(dto.password, existing.companyId)
      data.passwordHash = await bcrypt.hash(dto.password, 10)
      data.mustChangePassword = true  // ← força troca na próxima sessão
    }

    const updated = await this.usersRepository.update(id, data)

    // Dispara evento quando usuário é desativado
    if (dto.status === UserStatus.INACTIVE && existing.companyId) {
      this.notificationsService.notify({
        event: EventType.USER_DEACTIVATED,
        companyId: existing.companyId,
        data: {
          userName:  existing.name,
          userEmail: existing.email,
          userRole:  existing.role,
        },
      }).catch(() => { /* ignora falha */ })
    }

    return updated
  }

  // ─────────────────────────────────────────
  // Reset de senha pelo admin — devolve o usuário à senha padrão de primeiro
  // acesso da empresa. Restrito a COMPANY_ADMIN via @Roles no controller
  // (nunca exposto à grade de permissões de papéis personalizados).
  // ─────────────────────────────────────────
  async resetPassword(id: string, currentUser: AuthenticatedUser) {
    this.ensureCompanyScope(currentUser)

    if (id === currentUser.sub) {
      throw new ForbiddenException('Use a troca de senha do seu perfil para alterar a própria senha')
    }

    const companyScope = currentUser.role === UserRole.SUPER_ADMIN ? undefined : currentUser.companyId!
    const existing = await this.usersRepository.findById(id, companyScope)
    if (!existing) throw new NotFoundException('Usuário não encontrado')

    this.validateRoleHierarchy(existing.role as UserRole, currentUser)

    if (!existing.companyId) {
      throw new BadRequestException('Usuário sem empresa vinculada não pode receber a senha padrão')
    }

    const defaultHash = await this.loadDefaultFirstAccessPasswordHash(existing.companyId)
    if (!defaultHash) {
      throw new BadRequestException(
        'Configure a senha padrão de primeiro acesso da empresa em Configurações > Segurança antes de resetar senhas',
      )
    }

    await this.usersRepository.update(id, {
      passwordHash: defaultHash,
      mustChangePassword: true,
    })

    // A senha mudou — sessões ativas do usuário-alvo não devem sobreviver
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    this.logger.log(`Senha resetada para o padrão da empresa: ${existing.email} | por: ${currentUser.email}`)

    return { message: 'Senha redefinida para o padrão da empresa. O usuário deverá trocá-la no próximo login.' }
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

  /** Carrega os parâmetros de segurança da empresa (com defaults). */
  private async loadSecuritySettings(companyId: string | null | undefined) {
    if (!companyId) return DEFAULT_SECURITY_SETTINGS
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    })
    return getSecuritySettings(company?.settings)
  }

  /** Lê o hash da senha padrão de primeiro acesso configurada para a empresa (ou null). */
  private async loadDefaultFirstAccessPasswordHash(companyId: string | null | undefined) {
    if (!companyId) return null
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    })
    return getDefaultFirstAccessPasswordHash(company?.settings)
  }

  /** Valida o tamanho da senha contra o mínimo configurado para a empresa. */
  private async assertPasswordLength(password: string, companyId: string | null | undefined) {
    const { passwordMinLength } = await this.loadSecuritySettings(companyId)
    if (password.length < passwordMinLength) {
      throw new BadRequestException(`A senha deve ter no mínimo ${passwordMinLength} caracteres`)
    }
  }

  private validateRolePermission(role: UserRole, currentUser: AuthenticatedUser) {
    const { role: currentRole } = currentUser
    if (currentRole === UserRole.SUPER_ADMIN) return
    if (currentRole === UserRole.COMPANY_ADMIN && role !== UserRole.SUPER_ADMIN) return
    if (
      currentRole === UserRole.COMPANY_MANAGER &&
      ([...CLIENT_ROLES, UserRole.TECHNICIAN, UserRole.MEMBER] as UserRole[]).includes(role)
    ) return
    // CLIENT_ADMIN pode criar CLIENT_USER, CLIENT_VIEWER, TECHNICIAN e MEMBER dentro do seu próprio cliente
    if (
      currentRole === UserRole.CLIENT_ADMIN &&
      ([UserRole.CLIENT_USER, UserRole.CLIENT_VIEWER, UserRole.TECHNICIAN, UserRole.MEMBER] as UserRole[]).includes(role)
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
      [UserRole.MEMBER]: 5,
    }
    if (hierarchy[targetRole] >= hierarchy[currentUser.role]) {
      throw new ForbiddenException('Você não pode editar um usuário com papel igual ou superior ao seu')
    }
  }

  private resolveTenantIds(
    dto: CreateUserDto,
    currentUser: AuthenticatedUser,
    isCustomRoleOnly = false,
  ) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return { companyId: dto.companyId ?? null, clientId: dto.clientId ?? null }
    }
    const companyId = currentUser.companyId!
    // CLIENT_ADMIN sempre cria usuários no contexto do seu cliente (mesmo técnicos).
    // Quando só customRoleId foi fornecido, não inferimos clientId automaticamente —
    // o papel personalizado pode ser de empresa, não de cliente.
    const isClientRole = !isCustomRoleOnly && (dto.role
      ? (CLIENT_ROLES as UserRole[]).includes(dto.role)
      : false)
    const fallbackClientId = (isClientRole || currentUser.role === UserRole.CLIENT_ADMIN)
      ? currentUser.clientId
      : null
    const clientId = dto.clientId ?? fallbackClientId
    return { companyId, clientId }
  }
}