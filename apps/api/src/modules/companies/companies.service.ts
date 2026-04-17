import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { CompaniesRepository } from './companies.repository'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'
import { ListCompaniesDto } from './dto/list-companies.dto'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { NotificationConfigsService } from '../notification-configs/notification-configs.service'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)

  constructor(
    private companiesRepository: CompaniesRepository,
    private prisma: PrismaService,
    private configService: ConfigService,
    private notificationConfigs: NotificationConfigsService,
  ) { }

  async findAll(filters: ListCompaniesDto) {
    return this.companiesRepository.findMany(filters)
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.role === UserRole.COMPANY_ADMIN ||
      currentUser.role === UserRole.COMPANY_MANAGER
    ) {
      if (currentUser.companyId !== id) {
        throw new ForbiddenException('Acesso negado a esta empresa')
      }
    }

    const company = await this.companiesRepository.findById(id)

    if (!company) {
      throw new NotFoundException('Empresa não encontrada')
    }

    return company
  }

  async create(dto: CreateCompanyDto) {
    let slug = toSlug(dto.name)
    const slugTaken = await this.companiesRepository.slugExists(slug)

    if (slugTaken) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    if (dto.document) {
      const documentTaken = await this.companiesRepository.documentExists(dto.document)
      if (documentTaken) {
        throw new ConflictException('Já existe uma empresa com este CNPJ')
      }
    }

    const adminEmailTaken = await this.prisma.user.findUnique({
      where: { email: dto.admin.email },
      select: { id: true },
    })
    if (adminEmailTaken) {
      throw new ConflictException('Já existe um usuário com o email do administrador')
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 10)

    const platform = await this.prisma.platform.findFirst()
    if (!platform) {
      throw new NotFoundException('Plataforma não encontrada. Configure a Platform antes.')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          platformId: platform.id,
          name: dto.name,
          slug,
          document: dto.document,
          email: dto.email,
          phone: dto.phone,
          status: dto.status,
          trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
          licenseExpiresAt: dto.licenseExpiresAt ? new Date(dto.licenseExpiresAt) : null,
          street: dto.street,
          number: dto.number,
          complement: dto.complement,
          neighborhood: dto.neighborhood,
          city: dto.city,
          state: dto.state,
          zipCode: dto.zipCode,
        },
      })

      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          name: dto.admin.name,
          email: dto.admin.email,
          passwordHash,
          role: UserRole.COMPANY_ADMIN,
          phone: dto.admin.phone,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      })

      return { company, admin }
    })

    this.logger.log(
      `Empresa criada: ${result.company.name} | Admin: ${result.admin.email}`,
    )

    // Cria configs de notificação padrão para a nova empresa (fire-and-forget)
    this.notificationConfigs.seedDefaults(result.company.id).catch((err) =>
      this.logger.error(`Erro ao criar configs de notificação para empresa ${result.company.id}: ${err.message}`),
    )

    return {
      company: result.company,
      admin: result.admin,
    }
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    currentUser: AuthenticatedUser,
  ) {
    const company = await this.companiesRepository.findById(id)

    if (!company) {
      throw new NotFoundException('Empresa não encontrada')
    }

    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (currentUser.companyId !== id) {
        throw new ForbiddenException('Acesso negado a esta empresa')
      }
      delete dto.status
      delete dto.trialEndsAt
    }

    if (dto.document && dto.document !== company.document) {
      const documentTaken = await this.companiesRepository.documentExists(
        dto.document,
        id,
      )
      if (documentTaken) {
        throw new ConflictException('Já existe uma empresa com este CNPJ')
      }
    }

    return this.companiesRepository.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.document !== undefined && { document: dto.document }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.status && { status: dto.status }),
      ...(dto.trialEndsAt !== undefined && {
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
      }),
      ...(dto.settings !== undefined && { settings: dto.settings }),
      // Endereço
      ...(dto.street !== undefined && { street: dto.street }),
      ...(dto.number !== undefined && { number: dto.number }),
      ...(dto.complement !== undefined && { complement: dto.complement }),
      ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
      // Visual dos relatórios
      ...(dto.reportPrimaryColor !== undefined && { reportPrimaryColor: dto.reportPrimaryColor }),
      ...(dto.reportSecondaryColor !== undefined && { reportSecondaryColor: dto.reportSecondaryColor }),
      ...(dto.reportFooterText !== undefined && { reportFooterText: dto.reportFooterText }),
    })
  }

  async remove(id: string) {
    const company = await this.companiesRepository.findById(id)

    if (!company) {
      throw new NotFoundException('Empresa não encontrada')
    }

    await this.companiesRepository.softDelete(id)

    this.logger.warn(`Empresa removida: ${company.name} (id: ${id})`)

    return { message: 'Empresa removida com sucesso' }
  }

  // ─────────────────────────────────────────
  // Upload do logo da empresa
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
    const key = `logos/${id}/logo${ext}`

    await minio.putObject(bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    })

    // ✅ URL pública direta — sem presigned, sem expiração
    const endpoint = this.configService.get<string>('minio.endpoint', 'localhost')
    const port = this.configService.get<number>('minio.port', 9000)
    const useSSL = this.configService.get<boolean>('minio.useSSL', false)
    const protocol = useSSL ? 'https' : 'http'
    const logoUrl = `${protocol}://${endpoint}:${port}/${bucket}/${key}`

    await this.prisma.company.update({
      where: { id },
      data: { logoUrl },
    })

    this.logger.log(`Logo da empresa ${id} atualizado: ${logoUrl}`)
    return logoUrl
  }

  // ─────────────────────────────────────────
  // Atualizar configurações visuais dos relatórios
  // ─────────────────────────────────────────
  async updateReportSettings(
    id: string,
    dto: {
      reportPrimaryColor?: string
      reportSecondaryColor?: string
      reportHeaderTitle?: string
      reportFooterText?: string
    },
    currentUser: AuthenticatedUser,
  ) {
    await this.findOne(id, currentUser)

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.reportPrimaryColor !== undefined && { reportPrimaryColor: dto.reportPrimaryColor }),
        ...(dto.reportSecondaryColor !== undefined && { reportSecondaryColor: dto.reportSecondaryColor }),
        ...(dto.reportHeaderTitle !== undefined && { reportHeaderTitle: dto.reportHeaderTitle }),
        ...(dto.reportFooterText !== undefined && { reportFooterText: dto.reportFooterText }),
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        reportPrimaryColor: true,
        reportSecondaryColor: true,
        reportHeaderTitle: true,
        reportFooterText: true,
      },
    })
  }

  // ─────────────────────────────────────────
  // Busca template completo para os relatórios
  // ─────────────────────────────────────────
  async getReportTemplate(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        document: true,
        logoUrl: true,
        email: true,
        phone: true,
        street: true,
        number: true,
        complement: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        reportPrimaryColor: true,
        reportSecondaryColor: true,
        reportHeaderTitle: true,
        reportFooterText: true,
      },
    })

    const addressParts = [
      company?.street && company?.number
        ? `${company.street}, ${company.number}${company.complement ? ` ${company.complement}` : ''}`
        : company?.street ?? null,
      company?.neighborhood ?? null,
      company?.city && company?.state ? `${company.city} — ${company.state}` : company?.city ?? null,
      company?.zipCode ? `CEP ${company.zipCode}` : null,
    ].filter(Boolean)

    return {
      companyName: company?.name ?? '',
      document: company?.document ?? null,
      logoUrl: company?.logoUrl ?? null,
      primaryColor: company?.reportPrimaryColor ?? '#1E40AF',
      secondaryColor: company?.reportSecondaryColor ?? '#DBEAFE',
      headerTitle: company?.reportHeaderTitle ?? '',
      footerText: company?.reportFooterText ?? '',
      email: company?.email ?? '',
      phone: company?.phone ?? '',
      address: addressParts.join(' · '),
    }
  }
}