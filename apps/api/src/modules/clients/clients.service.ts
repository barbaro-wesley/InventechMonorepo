import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { UserRole, UserStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { ClientsRepository, CLIENT_SELECT } from './clients.repository'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { ListClientsDto } from './dto/list-clients.dto'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { Prisma } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { TwoFactorService } from '../auth/security/two-factor.service'

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name)

  constructor(
    private clientsRepository: ClientsRepository,
    private prisma: PrismaService,
    private configService: ConfigService,
    private twoFactorService: TwoFactorService,
  ) { }

  async findAll(currentUser: AuthenticatedUser, filters: ListClientsDto) {
    const companyId = currentUser.role === UserRole.SUPER_ADMIN
      ? (filters.companyId ?? currentUser.companyId!)
      : this.resolveCompanyId(currentUser)
    return this.clientsRepository.findMany(companyId, filters)
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    if (this.isClientRole(currentUser.role)) {
      if (currentUser.clientId !== id) {
        throw new ForbiddenException('Acesso negado a este cliente')
      }
    }

    const companyId = this.resolveCompanyId(currentUser)
    const client = await this.clientsRepository.findById(id, companyId)

    if (!client) {
      throw new NotFoundException('Cliente não encontrado')
    }

    return client
  }

  async create(dto: CreateClientDto, currentUser: AuthenticatedUser) {
    this.ensureCompanyRole(currentUser)

    const companyId = currentUser.role === UserRole.SUPER_ADMIN
      ? (dto.companyId ?? currentUser.companyId!)
      : currentUser.companyId!

    if (dto.document) {
      const documentTaken = await this.clientsRepository.documentExists(
        dto.document,
        companyId,
      )
      if (documentTaken) {
        throw new ConflictException(
          'Já existe um cliente com este CNPJ nesta empresa',
        )
      }
    }

    const adminEmailTaken = await this.prisma.user.findFirst({
      where: { email: dto.admin.email, deletedAt: null },
      select: { id: true },
    })
    if (adminEmailTaken) {
      throw new ConflictException('O e-mail do administrador já está em uso')
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 10)

    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: dto.name,
          document: dto.document,
          email: dto.email,
          phone: dto.phone,
          address: dto.address ? (dto.address as unknown as Prisma.InputJsonValue) : undefined,
          status: dto.status,
          company: { connect: { id: companyId } },
        },
        select: CLIENT_SELECT,
      })

      const admin = await tx.user.create({
        data: {
          name: dto.admin.name,
          email: dto.admin.email,
          passwordHash,
          role: UserRole.CLIENT_ADMIN,
          status: UserStatus.UNVERIFIED,
          phone: dto.admin.phone,
          company: { connect: { id: companyId } },
          client: { connect: { id: client.id } },
        },
        select: { id: true, name: true, email: true, role: true },
      })

      return { client, admin }
    })

    this.logger.log(
      `Cliente criado: ${result.client.name} | Admin: ${result.admin.email} | Empresa: ${companyId}`,
    )

    // Envia email de verificação para o admin — fora da transação para não revertê-la se o email falhar
    try {
      await this.twoFactorService.sendEmailVerification(result.admin.id)
    } catch (error) {
      this.logger.warn(
        `Não foi possível enviar email de verificação para ${result.admin.email}: ${error}`,
      )
    }

    return result
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    currentUser: AuthenticatedUser,
  ) {
    this.ensureCompanyRole(currentUser)

    const companyId = currentUser.companyId!
    const existing = await this.clientsRepository.findById(id, companyId)

    if (!existing) {
      throw new NotFoundException('Cliente não encontrado')
    }

    if (dto.document && dto.document !== existing.document) {
      const documentTaken = await this.clientsRepository.documentExists(
        dto.document,
        companyId,
        id,
      )
      if (documentTaken) {
        throw new ConflictException(
          'Já existe um cliente com este CNPJ nesta empresa',
        )
      }
    }

    return this.clientsRepository.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.document !== undefined && { document: dto.document }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.address !== undefined && {
        address: dto.address as unknown as Prisma.InputJsonValue,
      }),
      ...(dto.status && { status: dto.status }),
    })
  }

  async remove(id: string, currentUser: AuthenticatedUser) {
    this.ensureCompanyRole(currentUser)

    const companyId = currentUser.companyId!
    const existing = await this.clientsRepository.findById(id, companyId)

    if (!existing) {
      throw new NotFoundException('Cliente não encontrado')
    }

    const { _count } = existing
    if (_count.serviceOrders > 0) {
      throw new ConflictException(
        `Não é possível remover este cliente pois possui ` +
        `${_count.serviceOrders} ordem(ns) de serviço vinculados.`,
      )
    }

    await this.clientsRepository.softDelete(id)

    this.logger.warn(`Cliente removido: ${existing.name} (id: ${id})`)

    return { message: 'Cliente removido com sucesso' }
  }

  // ─────────────────────────────────────────
  // Upload do logo do cliente
  // Usa URL pública — logo não precisa de expiração
  // ─────────────────────────────────────────
  async uploadLogo(
    id: string,
    file: Express.Multer.File,
    currentUser: AuthenticatedUser,
  ): Promise<string> {
    await this.findOne(id, currentUser)

    const ext = file.mimetype === 'image/svg+xml' ? '.svg'
      : file.mimetype === 'image/png' ? '.png'
        : file.mimetype === 'image/webp' ? '.webp'
          : '.jpg'

    const { Client: MinioClient } = await import('minio')
    const minio = new MinioClient({
      endPoint: this.configService.get<string>('minio.endpoint', 'localhost'),
      port: this.configService.get<number>('minio.port', 9000),
      useSSL: this.configService.get<boolean>('minio.useSSL', false),
      accessKey: this.configService.get<string>('minio.accessKey', ''),
      secretKey: this.configService.get<string>('minio.secretKey', ''),
    })

    const bucket = 'avatars'
    const key = `clients-logos/${id}/logo${ext}`

    await minio.putObject(bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    })

    // ✅ URL pública direta — sem presigned, sem expiração
    const endpoint = this.configService.get<string>('minio.endpoint', 'localhost')
    const port = this.configService.get<number>('minio.port', 9000)
    const useSSL = this.configService.get<boolean>('minio.useSSL', false)
    const protocol = useSSL ? 'https' : 'http'
    const logoUrl = `${protocol}://${endpoint}:${port}/${bucket}/${key}`

    await this.clientsRepository.update(id, { logoUrl })

    this.logger.log(`Logo do cliente ${id} atualizado: ${logoUrl}`)
    return logoUrl
  }

  // ─────────────────────────────────────────
  // Grupos de manutenção do cliente
  // ─────────────────────────────────────────

  async listMaintenanceGroups(clientId: string, currentUser: AuthenticatedUser) {
    this.ensureCompanyRole(currentUser)
    const companyId = this.resolveCompanyId(currentUser)

    const client = await this.clientsRepository.findById(clientId, companyId)
    if (!client) throw new NotFoundException('Cliente não encontrado')

    return this.prisma.clientMaintenanceGroup.findMany({
      where: { clientId },
      select: {
        id: true,
        isActive: true,
        assignedAt: true,
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            isActive: true,
            equipmentTypes: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { group: { name: 'asc' } },
    })
  }

  async assignMaintenanceGroup(
    clientId: string,
    groupId: string,
    currentUser: AuthenticatedUser,
  ) {
    this.ensureCompanyRole(currentUser)
    const companyId = this.resolveCompanyId(currentUser)

    const [client, group] = await Promise.all([
      this.clientsRepository.findById(clientId, companyId),
      this.prisma.maintenanceGroup.findFirst({ where: { id: groupId, companyId } }),
    ])

    if (!client) throw new NotFoundException('Cliente não encontrado')
    if (!group) throw new NotFoundException('Grupo de manutenção não encontrado')

    return this.prisma.clientMaintenanceGroup.upsert({
      where: { clientId_groupId: { clientId, groupId } },
      create: { clientId, groupId, isActive: true, assignedAt: new Date() },
      update: { isActive: true },
      select: { id: true, isActive: true, assignedAt: true, group: { select: { id: true, name: true } } },
    })
  }

  async removeMaintenanceGroup(
    clientId: string,
    groupId: string,
    currentUser: AuthenticatedUser,
  ) {
    this.ensureCompanyRole(currentUser)
    const companyId = this.resolveCompanyId(currentUser)

    const client = await this.clientsRepository.findById(clientId, companyId)
    if (!client) throw new NotFoundException('Cliente não encontrado')

    const assignment = await this.prisma.clientMaintenanceGroup.findUnique({
      where: { clientId_groupId: { clientId, groupId } },
    })
    if (!assignment) throw new NotFoundException('Vínculo não encontrado')

    await this.prisma.clientMaintenanceGroup.delete({
      where: { clientId_groupId: { clientId, groupId } },
    })

    return { message: 'Grupo removido do cliente com sucesso' }
  }

  // ─────────────────────────────────────────
  // Helpers privados
  // ─────────────────────────────────────────

  private resolveCompanyId(user: AuthenticatedUser): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException(
          'SUPER_ADMIN deve informar o companyId para listar clientes',
        )
      }
    }
    return user.companyId!
  }

  private ensureCompanyRole(user: AuthenticatedUser) {
    const companyRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.COMPANY_MANAGER,
    ]
    if (!companyRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Apenas a empresa de manutenção pode gerenciar clientes',
      )
    }
    if (user.role !== UserRole.SUPER_ADMIN && !user.companyId) {
      throw new ForbiddenException('Acesso sem escopo de empresa')
    }
  }

  private isClientRole(role: UserRole): boolean {
    const clientRoles: UserRole[] = [
      UserRole.CLIENT_ADMIN,
      UserRole.CLIENT_USER,
      UserRole.CLIENT_VIEWER,
    ]
    return clientRoles.includes(role)
  }
}