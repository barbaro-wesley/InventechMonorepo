import { Module } from '@nestjs/common'

import { AccessoriesService } from './accessories.service'
import { AccessoriesController } from './accessories.controller'
import { EquipmentAccessoriesController } from './equipment-accessories.controller'

import { CategoriesService } from './categories/categories.service'
import { CategoriesController } from './categories/categories.controller'

import { AssignmentsService } from './assignments/assignments.service'
import { AssignmentsController } from './assignments/assignments.controller'

import { AccessoryMovementsService } from './movements/movements.service'
import { AccessoryMovementsController } from './movements/movements.controller'

import { MaintenancesService } from './maintenances/maintenances.service'
import { MaintenancesController } from './maintenances/maintenances.controller'

import { TemplatesService } from './templates/templates.service'
import { TemplatesController } from './templates/templates.controller'

@Module({
    controllers: [
        // Rotas estáticas ANTES das dinâmicas (/accessories/:id) para evitar conflito de matching
        CategoriesController,       // /accessories/categories (estático)
        TemplatesController,        // /accessories/templates  (estático)
        AccessoriesController,      // /accessories/:id        (dinâmico — deve vir depois)
        EquipmentAccessoriesController,
        AssignmentsController,
        AccessoryMovementsController,
        MaintenancesController,
    ],
    providers: [
        AccessoriesService,
        CategoriesService,
        AssignmentsService,
        AccessoryMovementsService,
        MaintenancesService,
        TemplatesService,
    ],
    exports: [AccessoriesService],
})
export class AccessoriesModule { }
