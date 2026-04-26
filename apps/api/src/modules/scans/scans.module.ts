import { Module } from '@nestjs/common'
import { ScansService } from './scans.service'
import { ScansController } from './scans.controller'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}
