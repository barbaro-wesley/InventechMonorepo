import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { JwtModule } from '@nestjs/jwt'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsProcessor } from './processors/Notifications.processor'
import { EmailChannel } from './channels/email.channel'
import { TelegramChannel } from './channels/telegram.channel'
import { AlertRuleDispatcher } from './alert-rule.dispatcher'
import { NOTIFICATION_QUEUE } from './notifications.constants'
import { NotificationConfigsModule } from '../notification-configs/notification-configs.module'

@Module({
    imports: [
        BullModule.registerQueue({
            name: NOTIFICATION_QUEUE,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            },
        }),
        JwtModule.register({}),
        NotificationConfigsModule,
    ],
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationsGateway,
        NotificationsProcessor,
        EmailChannel,
        TelegramChannel,
        AlertRuleDispatcher,
    ],
    exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule { }