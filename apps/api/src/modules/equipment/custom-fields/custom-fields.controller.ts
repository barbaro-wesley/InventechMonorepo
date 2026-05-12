import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { CustomFieldsService } from './custom-fields.service'
import {
    CreateCustomFieldDefinitionDto,
    UpdateCustomFieldDefinitionDto,
    ReorderCustomFieldsDto,
    UpsertCustomFieldValuesDto,
} from './dto/custom-field.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@Controller('equipment/custom-fields')
export class CustomFieldsController {
    constructor(private readonly service: CustomFieldsService) { }

    // ── Definições (por empresa) ─────────────────────────────────────────────

    @Get('definitions')
    @Permission('equipment-custom-field:list')
    listDefinitions(@CurrentUser() cu: AuthenticatedUser) {
        return this.service.listDefinitions(cu.companyId!)
    }

    @Post('definitions')
    @Permission('equipment-custom-field:create')
    createDefinition(
        @Body() dto: CreateCustomFieldDefinitionDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.service.createDefinition(cu.companyId!, dto)
    }

    @Patch('definitions/:id')
    @Permission('equipment-custom-field:update')
    updateDefinition(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCustomFieldDefinitionDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.service.updateDefinition(cu.companyId!, id, dto)
    }

    @Delete('definitions/:id')
    @HttpCode(HttpStatus.OK)
    @Permission('equipment-custom-field:delete')
    deleteDefinition(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.service.deleteDefinition(cu.companyId!, id)
    }

    @Post('definitions/reorder')
    @HttpCode(HttpStatus.OK)
    @Permission('equipment-custom-field:update')
    reorder(
        @Body() dto: ReorderCustomFieldsDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.service.reorder(cu.companyId!, dto)
    }

    // ── Valores (por equipamento) ────────────────────────────────────────────

    @Get(':equipmentId/values')
    @Permission('equipment-custom-field:read')
    getValues(@Param('equipmentId', ParseUUIDPipe) equipmentId: string) {
        return this.service.getValues(equipmentId)
    }

    @Post(':equipmentId/values')
    @HttpCode(HttpStatus.OK)
    @Permission('equipment-custom-field:write-values')
    upsertValues(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Body() dto: UpsertCustomFieldValuesDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.service.upsertValues(cu.companyId!, equipmentId, dto)
    }
}
