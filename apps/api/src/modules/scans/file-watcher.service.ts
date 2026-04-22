import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ScansService } from './scans.service'

@Injectable()
export class FileWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileWatcherService.name)
  private readonly baseDir: string
  private pollTimer: NodeJS.Timeout | null = null
  private readonly seenFiles = new Set<string>()
  private readonly pendingFiles = new Set<string>()

  constructor(
    private readonly scansService: ScansService,
    private readonly config: ConfigService,
  ) {
    this.baseDir = this.config.get<string>('SFTP_SCAN_BASE_DIR', '/srv/scans/incoming')
  }

  async onModuleInit() {
    if (process.platform === 'win32') {
      this.logger.warn('FileWatcher desativado — não suportado no Windows')
      return
    }

    try {
      await fs.access(this.baseDir)
    } catch {
      this.logger.warn(`Diretório base não encontrado: ${this.baseDir} — FileWatcher desativado`)
      return
    }

    await this.seedExistingFiles()

    this.pollTimer = setInterval(() => void this.pollDirectories(), 2000)
    this.logger.log(`Monitorando diretório SFTP (polling 2s): ${this.baseDir}`)
  }

  async onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.logger.log('File watcher encerrado')
    }
  }

  private async seedExistingFiles() {
    try {
      const subdirs = await fs.readdir(this.baseDir, { withFileTypes: true })
      for (const dirent of subdirs) {
        if (!dirent.isDirectory()) continue
        const subdir = path.join(this.baseDir, dirent.name)
        try {
          const files = await fs.readdir(subdir)
          for (const file of files) {
            this.seenFiles.add(path.join(subdir, file))
          }
        } catch { /* ignore */ }
      }
      this.logger.log(`FileWatcher: ${this.seenFiles.size} arquivos existentes ignorados na inicialização`)
    } catch { /* ignore */ }
  }

  private async pollDirectories() {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true })
      for (const dirent of entries) {
        if (!dirent.isDirectory() || dirent.name === '_error' || dirent.name.startsWith('.')) continue
        const subdir = path.join(this.baseDir, dirent.name)
        try {
          const files = await fs.readdir(subdir)
          for (const file of files) {
            if (file.startsWith('.') || file.endsWith('.tmp') || file.endsWith('.part')) continue
            const filePath = path.join(subdir, file)
            if (!this.seenFiles.has(filePath) && !this.pendingFiles.has(filePath)) {
              this.pendingFiles.add(filePath)
              this.logger.log(`Arquivo detectado (aguardando estabilização): ${file} [${dirent.name}]`)
              setTimeout(() => void this.processStableFile(filePath, dirent.name), 3000)
            }
          }
        } catch { /* subdiretório pode ter sido removido */ }
      }
    } catch (err) {
      this.logger.error(`Erro no poll: ${err}`)
    }
  }

  private async processStableFile(filePath: string, sftpDirectory: string) {
    try {
      const stat1 = await fs.stat(filePath)
      await new Promise<void>((r) => setTimeout(r, 2000))
      const stat2 = await fs.stat(filePath)

      if (stat1.size !== stat2.size) {
        this.logger.log(`Arquivo ainda sendo escrito: ${path.basename(filePath)}, reagendando...`)
        this.pendingFiles.delete(filePath)
        return
      }
    } catch {
      this.pendingFiles.delete(filePath)
      this.seenFiles.add(filePath)
      return
    }

    this.seenFiles.add(filePath)
    this.pendingFiles.delete(filePath)
    this.logger.log(`Processando: ${path.basename(filePath)} [${sftpDirectory}]`)
    await this.scansService.processFile(filePath, sftpDirectory)
  }
}
