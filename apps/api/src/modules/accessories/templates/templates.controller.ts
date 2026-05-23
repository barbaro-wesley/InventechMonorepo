import {
    Controller, Get, Post, Body, Param, Patch, Delete,
    ParseUUIDPipe, Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger'
import { TemplatesService } from './templates.service'
import { CreateAccessoryTemplateDto, UpdateAccessoryTemplateDto } from './dto/template.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@ApiTags('Accessory Templates')
@Controller('accessories/templates')
export class TemplatesController {
    constructor(private readonly templatesService: TemplatesService) { }

    @Get()
    @Permission('accessory_templates:read')
    @ApiOperation({ summary: 'Listar templates de acessório por tipo de equipamento' })
    @ApiQuery({ name: 'equipmentTypeId', required: false })
    findAll(
        @CurrentUser() cu: AuthenticatedUser,
        @Query('equipmentTypeId') equipmentTypeId?: string,
    ) {
        return this.templatesService.findAll(cu.companyId!, equipmentTypeId)
    }

    @Get(':id')
    @Permission('accessory_templates:read')
    @ApiOperation({ summary: 'Detalhe de um template' })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.templatesService.findOne(id, cu.companyId!)
    }

    @Post()
    @Permission('accessory_templates:create')
    @ApiOperation({ summary: 'Criar template de acessório para um tipo de equipamento' })
    create(
        @Body() dto: CreateAccessoryTemplateDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.templatesService.create(dto, cu.companyId!)
    }

    @Patch(':id')
    @Permission('accessory_templates:update')
    @ApiOperation({ summary: 'Atualizar template de acessório' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAccessoryTemplateDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.templatesService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @Permission('accessory_templates:delete')
    @ApiOperation({ summary: 'Remover template de acessório' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.templatesService.remove(id, cu.companyId!)
    }
}
