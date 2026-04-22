import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as Minio from 'minio'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ListScansDto } from './dto/scan.dto'

export const SCANS_BUCKET = 'scans'

@Injectable()
export class ScansService implements OnModuleInit {
  private readonly logger = new Logger(ScansService.name)
  private minioClient: Minio.Client

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

  // ─── Chamado pelo FileWatcherService ao detectar arquivo novo ───────────────

  async processFile(filePath: string, sftpDirectory: string): Promise<void> {
    const printer = await this.prisma.printer.findFirst({
      where: { sftpDirectory, isActive: true, deletedAt: null },
    })

    if (!printer) {
      this.logger.warn(`Nenhuma impressora ativa para diretório: ${sftpDirectory}`)
      await this.moveToError(filePath)
      return
    }

    const fileName = path.basename(filePath)
    const mimeType = this.detectMimeType(fileName)
    let fileBuffer: Buffer

    try {
      fileBuffer = await fs.readFile(filePath)
    } catch {
      this.logger.error(`Falha ao ler arquivo: ${filePath}`)
      return
    }

    const scan = await this.prisma.scan.create({
      data: {
        companyId: printer.companyId,
        printerId: printer.id,
        fileName,
        storedKey: '',
        bucket: SCANS_BUCKET,
        mimeType,
        sizeBytes: fileBuffer.length,
        status: 'PENDING',
      },
    })

    const storedKey = `${printer.companyId}/${printer.id}/${scan.id}/${fileName}`

    try {
      await this.minioClient.putObject(SCANS_BUCKET, storedKey, fileBuffer, fileBuffer.length, {
        'Content-Type': mimeType,
        'x-amz-meta-printer-id': printer.id,
        'x-amz-meta-company-id': printer.companyId,
        'x-amz-meta-original-name': encodeURIComponent(fileName),
      })

      await this.prisma.scan.update({
        where: { id: scan.id },
        data: { storedKey, status: 'PROCESSED', processedAt: new Date() },
      })

      await fs.unlink(filePath)
      this.logger.log(`Scan processado: ${fileName} [${printer.name}] → ${storedKey}`)
    } catch (err) {
      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          storedKey,
          status: 'ERROR',
          errorMsg: err instanceof Error ? err.message : String(err),
        },
      })
      await this.moveToError(filePath)
      this.logger.error(`Falha ao processar scan ${fileName}: ${err}`)
    }
  }

  // ─── API endpoints ───────────────────────────────────────────────────────────

  async findAll(cu: AuthenticatedUser, filters: ListScansDto) {
    return this.prisma.scan.findMany({
      where: {
        companyId: cu.companyId!,
        ...(filters.printerId && { printerId: filters.printerId }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: { scannedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        scannedAt: true,
        processedAt: true,
        printer: { select: { id: true, name: true, brand: true, model: true, costCenter: { select: { id: true, name: true, code: true } } } },
      },
      take: 200,
    })
  }

  async findOne(id: string, cu: AuthenticatedUser) {
    const scan = await this.prisma.scan.findFirst({
      where: { id, companyId: cu.companyId! },
      include: { printer: { select: { id: true, name: true, costCenter: { select: { id: true, name: true, code: true } } } } },
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

  private async moveToError(filePath: string) {
    const errorDir = path.join(path.dirname(filePath), '..', '_error')
    await fs.mkdir(errorDir, { recursive: true })
    const dest = path.join(errorDir, path.basename(filePath))
    await fs.rename(filePath, dest).catch(() => null)
  }
}
