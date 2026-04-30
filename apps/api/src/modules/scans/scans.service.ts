import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import * as path from 'path'
import * as Minio from 'minio'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsGateway } from '../notifications/notifications.gateway'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ListScansDto, UpdateScanMetadataDto } from './dto/scan.dto'

export const SCANS_BUCKET = 'scans'

// Shape mínimo retornado pela listagem — reutilizado pelo webhook
const SCAN_SELECT = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  scannedAt: true,
  processedAt: true,
  printer: {
    select: {
      id: true,
      name: true,
      brand: true,
      model: true,
      costCenter: { select: { id: true, name: true, code: true } },
    },
  },
  metadata: {
    select: {
      ocrStatus: true,
      paciente: true,
      cpf: true,
      prontuario: true,
      numeroAtendimento: true,
      extractedAt: true,
    },
  },
} as const

@Injectable()
export class ScansService implements OnModuleInit {
  private readonly logger = new Logger(ScansService.name)
  private minioClient: Minio.Client

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async onModuleInit() {
    this.minioClient = new Minio.Client({
      endPoint: this.config.get<string>('minio.endpoint', 'localhost'),
      port: this.config.get<number>('minio.port', 9000),
      useSSL: this.config.get<boolean>('minio.useSSL', false),
      accessKey: this.config.get<string>('minio.accessKey', ''),
      secretKey: this.config.get<string>('minio.secretKey', ''),
    })

    await this.ensureBucket()
  }

  // ─── API endpoints ───────────────────────────────────────────────────────────

  async findAll(cu: AuthenticatedUser, filters: ListScansDto) {
    const { printerId, status, search, cursor, limit = 50 } = filters
    const term = search?.trim()

    const where = {
      companyId: cu.companyId!,
      ...(printerId && { printerId }),
      ...(status && { status }),
      ...(term && {
        metadata: {
          OR: [
            { paciente: { contains: term, mode: 'insensitive' as const } },
            { prontuario: { contains: term, mode: 'insensitive' as const } },
            { numeroAtendimento: { contains: term, mode: 'insensitive' as const } },
            { cpf: { contains: term.replace(/\D/g, ''), mode: 'insensitive' as const } },
          ],
        },
      }),
      // Cursor: retorna apenas scans mais antigos que o cursor (scannedAt anterior)
      ...(cursor && { scannedAt: { lt: new Date(cursor) } }),
    }

    // Busca limit+1 para saber se há próxima página sem custo extra
    const items = await this.prisma.scan.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      select: SCAN_SELECT,
      take: limit + 1,
    })

    const hasNextPage = items.length > limit
    const data = hasNextPage ? items.slice(0, limit) : items
    const nextCursor = hasNextPage ? data[data.length - 1].scannedAt.toISOString() : null

    return { data, nextCursor, hasNextPage }
  }

  async findOne(id: string, cu: AuthenticatedUser) {
    const scan = await this.prisma.scan.findFirst({
      where: { id, companyId: cu.companyId! },
      include: {
        printer: {
          select: {
            id: true,
            name: true,
            costCenter: { select: { id: true, name: true, code: true } },
          },
        },
        metadata: true,
      },
    })
    if (!scan) throw new NotFoundException('Scan não encontrado')
    return scan
  }

  async download(id: string, cu: AuthenticatedUser) {
    const scan = await this.findOne(id, cu)
    if (scan.status !== 'PROCESSED') throw new NotFoundException('Arquivo ainda não disponível')
    const stream = await this.minioClient.getObject(scan.bucket, scan.storedKey)
    return { stream, fileName: scan.fileName, mimeType: scan.mimeType, sizeBytes: scan.sizeBytes }
  }

  async updateMetadata(id: string, dto: UpdateScanMetadataDto, cu: AuthenticatedUser) {
    const scan = await this.findOne(id, cu)

    const data = {
      paciente: dto.paciente ?? null,
      cpf: dto.cpf?.replace(/\D/g, '') ?? null,
      prontuario: dto.prontuario ?? null,
      numeroAtendimento: dto.numeroAtendimento ?? null,
    }

    await this.prisma.scanMetadata.upsert({
      where: { scanId: scan.id },
      create: { scanId: scan.id, ocrStatus: 'PENDING', ...data },
      update: data,
    })

    return this.findOne(id, cu)
  }

  async remove(id: string, cu: AuthenticatedUser) {
    const scan = await this.findOne(id, cu)

    if (scan.storedKey) {
      try {
        await this.minioClient.removeObject(scan.bucket, scan.storedKey)
      } catch {
        this.logger.warn(`Objeto MinIO não encontrado ao deletar scan ${id}`)
      }
    }

    await this.prisma.scan.delete({ where: { id } })
    return { message: 'Scan removido' }
  }

  // ─── Webhook interno (chamado pelo OCR worker) ────────────────────────────────

  async notifyProcessed(scanId: string, companyId: string) {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, companyId },
      select: SCAN_SELECT,
    })

    if (!scan) {
      this.logger.warn(`Webhook: scan ${scanId} não encontrado para empresa ${companyId}`)
      return
    }

    this.gateway.emitScanEvent(companyId, {
      event: 'scan:processed',
      scan,
    })

    this.logger.log(
      `WS scan:processed → company:${companyId} | ${scan.fileName} | ocr=${scan.metadata?.ocrStatus}`,
    )
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async ensureBucket() {
    const exists = await this.minioClient.bucketExists(SCANS_BUCKET)
    if (!exists) {
      await this.minioClient.makeBucket(SCANS_BUCKET)
      this.logger.log(`Bucket '${SCANS_BUCKET}' criado`)
    }
  }

  private detectMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase()
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    }
    return map[ext] ?? 'application/octet-stream'
  }
}
