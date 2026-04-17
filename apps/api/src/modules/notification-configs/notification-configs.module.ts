import { Module } from '@nestjs/common'
import { NotificationConfigsService } from './notification-configs.service'
import { NotificationConfigsController } from './notification-configs.controller'

@Module({
    controllers: [NotificationConfigsController],
    providers: [NotificationConfigsService],
    exports: [NotificationConfigsService],
})
export class NotificationConfigsModule {}
