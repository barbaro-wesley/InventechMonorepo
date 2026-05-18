import { Module } from '@nestjs/common'
import { InventoryController } from './inventory.controller'
import { InventoryService } from './inventory.service'
import { MovementsController } from './movements/movements.controller'
import { MovementsService } from './movements/movements.service'
import { CategoriesController } from './categories/categories.controller'
import { CategoriesService } from './categories/categories.service'
import { StockPointsController } from './stock-points/stock-points.controller'
import { StockPointsService } from './stock-points/stock-points.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
    imports: [NotificationsModule],
    controllers: [StockPointsController, CategoriesController, MovementsController, InventoryController],
    providers: [InventoryService, MovementsService, CategoriesService, StockPointsService],
    exports: [InventoryService],
})
export class InventoryModule {}
