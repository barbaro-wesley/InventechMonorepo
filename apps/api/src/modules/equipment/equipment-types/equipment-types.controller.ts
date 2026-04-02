import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { EquipmentTypesService } from './equipment-types.service'
import {
    CreateEquipmentTypeDto, UpdateEquipmentTypeDto,
    CreateEquipmentSubtypeDto, UpdateEquipmentSubtypeDto,
    ListEquipmentTypesDto,
} from './dto/equipment-type.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@Controller('equipment-types')
export class EquipmentTypesController {
    constructor(private readonly equipmentTypesService: EquipmentTypesService) { }

    @Get()
    @Permission('equipment-type:list')
    findAll(@Query() filters: ListEquipmentTypesDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.equipmentTypesService.findAllTypes(cu.tenantId!, filters)
    }

    @Get(':id')
    @Permission('equipment-type:read')
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.equipmentTypesService.findOneType(id, cu.tenantId!)
    }

    @Post()
    @Permission('equipment-type:create')
    createType(@Body() dto: CreateEquipmentTypeDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.equipmentTypesService.createType(dto, cu.tenantId!)
    }

    @Patch(':id')
    @Permission('equipment-type:update')
    updateType(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateEquipmentTypeDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.equipmentTypesService.updateType(id, dto, cu.tenantId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('equipment-type:delete')
    removeType(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.equipmentTypesService.removeType(id, cu.tenantId!)
    }

    @Post('subtypes')
    @Permission('equipment-type:create-sub')
    createSubtype(@Body() dto: CreateEquipmentSubtypeDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.equipmentTypesService.createSubtype(dto, cu.tenantId!)
    }

    @Patch('subtypes/:id')
    @Permission('equipment-type:update-sub')
    updateSubtype(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateEquipmentSubtypeDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.equipmentTypesService.updateSubtype(id, dto, cu.tenantId!)
    }

    @Delete('subtypes/:id')
    @HttpCode(HttpStatus.OK)
    @Permission('equipment-type:delete-sub')
    removeSubtype(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.equipmentTypesService.removeSubtype(id, cu.tenantId!)
    }
}
