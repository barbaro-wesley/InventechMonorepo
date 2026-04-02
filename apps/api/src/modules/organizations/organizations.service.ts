import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { UserRole, UserStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { OrganizationsRepository, CLIENT_SELECT } from './organizations.repository'
import { CreateClientDto } from './dto/create-organization.dto'
import { UpdateClientDto } from './dto/update-organization.dto'
import { ListClientsDto } from './dto/list-organizations.dto'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { Prisma } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { TwoFactorService } from '../auth/security/two-factor.service'

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name)

  constructor(
    private organizationsRepository: OrganizationsRepository,
    private prisma: PrismaService,
    private configService: ConfigService,
    private twoFactorService: TwoFactorService,
  ) { }

  async findAll(currentUser: AuthenticatedUser, filters: ListClientsDto) {
    const tenantId = currentUser.role === UserRole.SUPER_ADMIN
      ? (filters.tenantId ?? currentUser.tenantId!)
      : this.resolveCompanyId(currentUser)
    return this.organizationsRepository.findMany(tenantId, filters)
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    if (this.isClientRole(currentUser.role)) {
      if (currentUser.organizationId !== id) {
        throw new ForbiddenException('Acesso negado a este cliente')
      }
    }

    const tenantId = this.resolveCompanyId(currentUser)
    const client = await this.organizationsRepository.findById(id, tenantId)

    if (!client) {
      throw new NotFoundException('Cliente não encontrado')
    }

    return client
  }

  async create(dto: CreateClientDto, currentUser: AuthenticatedUser) {
    this.ensureCompanyRole(currentUser)

    const tenantId = currentUser.role === UserRole.SUPER_ADMIN
      ? (dto.tenantId ?? currentUser.tenantId!)
      : currentUser.tenantId!

    if (dto.document) {
      const documentTaken = await this.organizationsRepository.documentExists(
        dto.document,
        tenantId,
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
          company: { connect: { id: tenantId } },
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
          company: { connect: { id: tenantId } },
          organization: { connect: { id: client.id } },
        },
        select: { id: true, name: true, email: true, role: true },
      })

      return { client, admin }
    })

    this.logger.log(
      `Cliente criado: ${result.client.name} | Admin: ${result.admin.email} | Empresa: ${tenantId}`,
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

    const tenantId = currentUser.tenantId!
    const existing = await this.organizationsRepository.findById(id, tenantId)

    if (!existing) {
      throw new NotFoundException('Cliente não encontrado')
    }

    if (dto.document && dto.document !== existing.document) {
      const documentTaken = await this.organizationsRepository.documentExists(
        dto.document,
        tenantId,
        id,
      )
      if (documentTaken) {
        throw new ConflictException(
          'Já existe um cliente com este CNPJ nesta empresa',
        )
      }
    }

    return this.organizationsRepository.update(id, {
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

    const tenantId = currentUser.tenantId!
    const existing = await this.organizationsRepository.findById(id, tenantId)

    if (!existing) {
      throw new NotFoundException('Cliente não encontrado')
    }

    const { _count } = existing
    if (_count.equipments > 0 || _count.serviceOrders > 0) {
      throw new ConflictException(
        `Não é possível remover este cliente pois possui ` +
        `${_count.equipments} equipamento(s) e ` +
        `${_count.serviceOrders} ordem(ns) de serviço vinculados.`,
      )
    }

    await this.organizationsRepository.softDelete(id)

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
    const key = `organizations-logos/${id}/logo${ext}`

    await minio.putObject(bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    })

    // ✅ URL pública direta — sem presigned, sem expiração
    const endpoint = this.configService.get<string>('minio.endpoint', 'localhost')
    const port = this.configService.get<number>('minio.port', 9000)
    const useSSL = this.configService.get<boolean>('minio.useSSL', false)
    const protocol = useSSL ? 'https' : 'http'
    const logoUrl = `${protocol}://${endpoint}:${port}/${bucket}/${key}`

    await this.organizationsRepository.update(id, { logoUrl })

    this.logger.log(`Logo do cliente ${id} atualizado: ${logoUrl}`)
    return logoUrl
  }

  // ─────────────────────────────────────────
  // Helpers privados
  // ─────────────────────────────────────────

  private resolveCompanyId(user: AuthenticatedUser): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!user.tenantId) {
        throw new ForbiddenException(
          'SUPER_ADMIN deve informar o tenantId para listar clientes',
        )
      }
    }
    return user.tenantId!
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
    if (user.role !== UserRole.SUPER_ADMIN && !user.tenantId) {
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