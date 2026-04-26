import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { CreatePrinterDto, UpdatePrinterDto, ListPrintersDto } from './dto/printer.dto'

const COST_CENTER_SELECT = { id: true, name: true, code: true }

@Injectable()
export class PrintersService {
  private readonly logger = new Logger(PrintersService.name)
  private readonly baseDir: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseDir = this.config.get<string>('SFTP_SCAN_BASE_DIR', '/srv/scans/incoming')
  }

  async create(dto: CreatePrinterDto, cu: AuthenticatedUser) {
    if (dto.costCenterId) {
      await this.validateCostCenter(dto.costCenterId, cu.companyId!)
    }

    const slug = this.buildSlug(dto.name)
    const existing = await this.prisma.printer.findUnique({ where: { sftpDirectory: slug } })
    if (existing) throw new ConflictException(`Diretório SFTP '${slug}' já está em uso`)

    await this.ensureDirectory(slug)

    const printer = await this.prisma.printer.create({
      data: {
        companyId: cu.companyId!,
        name: dto.name,
        ipAddress: dto.ipAddress,
        model: dto.model,
        brand: dto.brand,
        costCenterId: dto.costCenterId,
        notes: dto.notes,
        sftpDirectory: slug,
      },
      include: { costCenter: { select: COST_CENTER_SELECT } },
    })

    this.logger.log(`Impressora criada: ${printer.name} → ${slug}`)
    return { ...printer, sftpConfig: this.buildSftpConfig(slug) }
  }

  async findAll(cu: AuthenticatedUser, filters: ListPrintersDto) {
    return this.prisma.printer.findMany({
      where: {
        companyId: cu.companyId!,
        deletedAt: null,
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.costCenterId && { costCenterId: filters.costCenterId }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        model: true,
        brand: true,
        sftpDirectory: true,
        isActive: true,
        notes: true,
        createdAt: true,
        costCenter: { select: COST_CENTER_SELECT },
        _count: { select: { scans: true } },
      },
    })
  }

  async findOne(id: string, cu: AuthenticatedUser) {
    const printer = await this.prisma.printer.findFirst({
      where: { id, companyId: cu.companyId!, deletedAt: null },
      include: {
        costCenter: { select: COST_CENTER_SELECT },
        _count: { select: { scans: true } },
      },
    })
    if (!printer) throw new NotFoundException('Impressora não encontrada')
    return { ...printer, sftpConfig: this.buildSftpConfig(printer.sftpDirectory) }
  }

  async update(id: string, dto: UpdatePrinterDto, cu: AuthenticatedUser) {
    await this.findOne(id, cu)

    if (dto.costCenterId) {
      await this.validateCostCenter(dto.costCenterId, cu.companyId!)
    }

    return this.prisma.printer.update({
      where: { id },
      data: dto,
      include: { costCenter: { select: COST_CENTER_SELECT } },
    })
  }

  async remove(id: string, cu: AuthenticatedUser) {
    await this.findOne(id, cu)
    await this.prisma.printer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
    return { message: 'Impressora removida' }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async validateCostCenter(costCenterId: string, companyId: string) {
    const cc = await this.prisma.costCenter.findFirst({
      where: { id: costCenterId, companyId },
    })
    if (!cc) throw new NotFoundException('Centro de custo não encontrado')
  }

  private buildSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60)
  }

  private async ensureDirectory(slug: string) {
    const dirPath = path.join(this.baseDir, slug)
    await fs.mkdir(dirPath, { recursive: true })
    await fs.chmod(dirPath, 0o777)
    this.logger.log(`Diretório SFTP criado: ${dirPath}`)
  }

  buildSftpConfig(sftpDirectory: string) {
    return {
      host: this.config.get<string>('SFTP_HOST', '192.168.0.70'),
      port: 22,
      username: 'scanner',
      remoteDirectory: path.join(this.baseDir, sftpDirectory).replace(/\\/g, '/'),
    }
  }
}
