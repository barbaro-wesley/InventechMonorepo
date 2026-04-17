import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common'
import { EventType } from '@prisma/client'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { Permission } from '../../common/decorators/permission.decorator'
import { NotificationConfigsService } from './notification-configs.service'
import { UpsertNotificationConfigDto } from './dto/upsert-notification-config.dto'

@Controller('notification-configs')
export class NotificationConfigsController {
    constructor(private readonly service: NotificationConfigsService) {}

    @Get()
    @Permission('notification-config:list')
    findAll(@CurrentUser() user: AuthenticatedUser) {
        return this.service.findAll(user.companyId!)
    }

    @Put(':eventType')
    @Permission('notification-config:update')
    upsert(
        @CurrentUser() user: AuthenticatedUser,
        @Param('eventType') eventType: EventType,
        @Body() dto: UpsertNotificationConfigDto,
    ) {
        return this.service.upsert(user.companyId!, eventType, dto)
    }

    @Patch(':eventType/toggle')
    @Permission('notification-config:update')
    toggle(
        @CurrentUser() user: AuthenticatedUser,
        @Param('eventType') eventType: EventType,
    ) {
        return this.service.toggle(user.companyId!, eventType)
    }
}
