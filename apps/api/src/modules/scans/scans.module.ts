import { Module } from '@nestjs/common'
import { ScansService } from './scans.service'
import { ScansController } from './scans.controller'
import { FileWatcherService } from './file-watcher.service'

@Module({
  controllers: [ScansController],
  providers: [ScansService, FileWatcherService],
  exports: [ScansService],
})
export class ScansModule {}
