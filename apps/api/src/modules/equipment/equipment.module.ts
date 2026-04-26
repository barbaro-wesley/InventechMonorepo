import { Module } from '@nestjs/common'

// Equipment principal
import { EquipmentService } from './equipment.service'
import { EquipmentController } from './equipment.controller'

// Locations
import { LocationsService } from './locations/locations.service'
import { LocationsController } from './locations/locations.controller'

// Cost Centers
import { CostCentersService } from './cost-centers/cost-centers.service'
import { CostCentersController } from './cost-centers/cost-centers.controller'

// Equipment Types
import { EquipmentTypesService } from './equipment-types/equipment-types.service'
import { EquipmentTypesController } from './equipment-types/equipment-types.controller'

// Movements
import { MovementsService } from './movement/movements.service'
import { MovementsController } from './movement/movements.controller'

// Manuals
import { ManualsService } from './manuals/manuals.service'
import { ManualsController } from './manuals/manuals.controller'

import { StorageModule } from '../storage/storage.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ReportsModule } from '../reports/reports.module'

@Module({
    imports: [StorageModule, NotificationsModule, ReportsModule],
    controllers: [
        EquipmentController,
        LocationsController,
        CostCentersController,
        EquipmentTypesController,
        MovementsController,
        ManualsController,
    ],
    providers: [
        EquipmentService,
        LocationsService,
        CostCentersService,
        EquipmentTypesService,
        MovementsService,
        ManualsService,
    ],
    exports: [EquipmentService],
})
export class EquipmentModule { }