import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as path from 'path'
import * as chokidar from 'chokidar'
import { ScansService } from './scans.service'

@Injectable()
export class FileWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileWatcherService.name)
  private watcher: chokidar.FSWatcher | null = null
  private readonly baseDir: string

  constructor(
    private readonly scansService: ScansService,
    private readonly config: ConfigService,
  ) {
    this.baseDir = this.config.get<string>('SFTP_SCAN_BASE_DIR', '/srv/scans/incoming')
  }

  async onModuleInit() {
    // No Windows ou quando o diretório base não existe, o watcher é ignorado
    if (process.platform === 'win32') {
      this.logger.warn('FileWatcher desativado — não suportado no Windows (use o servidor Linux)')
      return
    }

    const fs = await import('fs/promises')
    try {
      await fs.access(this.baseDir)
    } catch {
      this.logger.warn(`Diretório base não encontrado: ${this.baseDir} — FileWatcher desativado`)
      return
    }

    this.watcher = chokidar.watch(`${this.baseDir}/**/*`, {
      ignored: [
        // ignora diretórios e arquivos de erro/temporários
        /(^|[/\\])\../,
        `${this.baseDir}/_error/**`,
        /\.tmp$/,
        /\.part$/,
      ],
      persistent: true,
      ignoreInitial: true,
      // aguarda o arquivo ser completamente escrito antes de emitir o evento
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
      depth: 1,
    })

    this.watcher.on('add', (filePath) => this.handleNewFile(filePath))
    this.watcher.on('error', (err) => this.logger.error(`Watcher error: ${err}`))

    this.logger.log(`Monitorando diretório SFTP: ${this.baseDir}`)
  }

  async onModuleDestroy() {
    if (this.watcher) {
      await this.watcher.close()
      this.logger.log('File watcher encerrado')
    }
  }

  private async handleNewFile(filePath: string) {
    // extrai o slug do diretório pai (ex: /srv/scans/incoming/rh-brother/scan.pdf → rh-brother)
    const sftpDirectory = path.basename(path.dirname(filePath))
    this.logger.log(`Arquivo detectado: ${path.basename(filePath)} [${sftpDirectory}]`)
    await this.scansService.processFile(filePath, sftpDirectory)
  }
}
