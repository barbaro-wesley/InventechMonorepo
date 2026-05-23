import {
    Controller, Get, Post, Body, Param, Patch, Delete,
    ParseUUIDPipe, Query, ParseBoolPipe, DefaultValuePipe,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CategoriesService } from './categories.service'
import { CreateAccessoryCategoryDto, UpdateAccessoryCategoryDto } from './dto/category.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@ApiTags('Accessory Categories')
@Controller('accessories/categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Get()
    @Permission('accessory_categories:read')
    @ApiOperation({ summary: 'Listar categorias de acessório' })
    findAll(
        @CurrentUser() cu: AuthenticatedUser,
        @Query('onlyActive', new DefaultValuePipe(false), ParseBoolPipe) onlyActive: boolean,
    ) {
        return this.categoriesService.findAll(cu.companyId!, onlyActive)
    }

    @Get(':id')
    @Permission('accessory_categories:read')
    @ApiOperation({ summary: 'Detalhe de uma categoria' })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.categoriesService.findOne(id, cu.companyId!)
    }

    @Post()
    @Permission('accessory_categories:create')
    @ApiOperation({ summary: 'Criar categoria de acessório' })
    @ApiResponse({ status: 201 })
    create(
        @Body() dto: CreateAccessoryCategoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.categoriesService.create(dto, cu.companyId!)
    }

    @Patch(':id')
    @Permission('accessory_categories:update')
    @ApiOperation({ summary: 'Atualizar categoria de acessório' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAccessoryCategoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.categoriesService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @Permission('accessory_categories:delete')
    @ApiOperation({ summary: 'Remover categoria (só se não tiver acessórios)' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.categoriesService.remove(id, cu.companyId!)
    }
}
