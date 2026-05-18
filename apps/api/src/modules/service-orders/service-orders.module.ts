import { Module } from '@nestjs/common'
import { ServiceOrdersService } from './service-orders.service'
import { ServiceOrdersController } from './service-orders.controller'
import { CompanyServiceOrdersController } from './company-service-orders.controller'
import { CommentsService } from './comments/comments.service'
import { TasksService } from './tasks/tasks.service'
import { CostsService } from './costs/costs.service'
import { MaterialsService } from './materials/materials.service'
import { ChecklistsService } from './checklists/checklists.service'
import { ChecklistsController } from './checklists/checklists.controller'
import { StorageModule } from '../storage/storage.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AutoApproveJob } from './jobs/auto-approve.job'
import { InventoryModule } from '../inventory/inventory.module'

@Module({
    imports: [
        StorageModule,
        NotificationsModule,
        InventoryModule,
    ],
    controllers: [
        ServiceOrdersController,
        CompanyServiceOrdersController,
        ChecklistsController,
    ],
    providers: [
        ServiceOrdersService,
        CommentsService,
        TasksService,
        CostsService,
        MaterialsService,
        ChecklistsService,
        AutoApproveJob,
    ],
    exports: [ServiceOrdersService, ChecklistsService],
})
export class ServiceOrdersModule { }