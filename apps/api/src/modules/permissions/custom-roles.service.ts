import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { PermissionsService } from './permissions.service'
import { RESOURCE_ACTIONS } from './permissions.defaults'
import type {
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
  SetCustomRolePermissionsDto,
} from './dto/permissions.dto'

@Injectable()
export class CustomRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.customRole.findMany({
      where: { tenantId },
      include: {
        permissions: { orderBy: [{ resource: 'asc' }, { action: 'asc' }] },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: string, tenantId: string) {
    const role = await this.prisma.customRole.findFirst({
      where: { id, tenantId },
      include: {
        permissions: { orderBy: [{ resource: 'asc' }, { action: 'asc' }] },
        _count: { select: { users: true } },
      },
    })
    if (!role) throw new NotFoundException('Papel personalizado não encontrado')
    return role
  }

  async create(tenantId: string, dto: CreateCustomRoleDto) {
    const exists = await this.prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    })
    if (exists) throw new ConflictException(`Já existe um papel com o nome "${dto.name}"`)

    return this.prisma.customRole.create({
      data: { tenantId, name: dto.name, description: dto.description },
      include: { permissions: true, _count: { select: { users: true } } },
    })
  }

  async update(id: string, tenantId: string, dto: UpdateCustomRoleDto) {
    const role = await this.findOne(id, tenantId)

    if (dto.name && dto.name !== role.name) {
      const exists = await this.prisma.customRole.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      })
      if (exists) throw new ConflictException(`Já existe um papel com o nome "${dto.name}"`)
    }

    return this.prisma.customRole.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { permissions: true, _count: { select: { users: true } } },
    })
  }

  async remove(id: string, tenantId: string) {
    const role = await this.findOne(id, tenantId)

    if (role._count.users > 0) {
      throw new ForbiddenException(
        `Não é possível remover: ${role._count.users} usuário(s) com este papel. ` +
        'Reatribua-os antes de deletar.',
      )
    }

    await this.prisma.customRole.delete({ where: { id } })
    this.permissionsService.invalidateCustomRoleCache(id)
    return { message: `Papel "${role.name}" removido` }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Gerenciamento de permissões do papel (substitui todas de uma vez)
  // ─────────────────────────────────────────────────────────────────────────────

  async setPermissions(id: string, tenantId: string, dto: SetCustomRolePermissionsDto) {
    await this.findOne(id, tenantId) // valida posse

    // Valida que cada resource:action existe na matriz
    const invalid = dto.permissions.filter(
      (p) => !RESOURCE_ACTIONS[p.resource]?.includes(p.action),
    )
    if (invalid.length) {
      throw new ForbiddenException(
        `Permissões inválidas: ${invalid.map((p) => `${p.resource}:${p.action}`).join(', ')}`,
      )
    }

    // Substitui todas as permissões em uma transação
    await this.prisma.$transaction([
      this.prisma.customRolePermission.deleteMany({ where: { customRoleId: id } }),
      this.prisma.customRolePermission.createMany({
        data: dto.permissions.map((p) => ({
          customRoleId: id,
          resource: p.resource,
          action: p.action,
        })),
        skipDuplicates: true,
      }),
    ])

    this.permissionsService.invalidateCustomRoleCache(id)

    return this.findOne(id, tenantId)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Atribuição de custom role a um usuário
  // ─────────────────────────────────────────────────────────────────────────────

  async assignToUser(userId: string, tenantId: string, customRoleId: string | null) {
    // Valida que o usuário pertence à empresa
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    // Valida que o custom role pertence à empresa (se fornecido)
    if (customRoleId) {
      const role = await this.prisma.customRole.findFirst({
        where: { id: customRoleId, tenantId, isActive: true },
      })
      if (!role) throw new NotFoundException('Papel personalizado não encontrado ou inativo')
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId },
    })

    return {
      userId,
      customRoleId,
      message: customRoleId
        ? 'Papel personalizado atribuído com sucesso'
        : 'Papel personalizado removido — usuário voltou ao papel de sistema',
    }
  }
}
