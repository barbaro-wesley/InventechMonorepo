import {
    Body, Controller, Delete, Get, HttpCode, HttpStatus,
    Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateStockCategoryDto, ListStockCategoriesDto, UpdateStockCategoryDto } from './dto/category.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { Permission } from '../../../common/decorators/permission.decorator'

@Controller('inventory/categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get()
    @Permission('inventory:list')
    findAll(@Query() filters: ListStockCategoriesDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.categoriesService.findAll(cu.companyId!, filters)
    }

    @Get(':id')
    @Permission('inventory:read')
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.categoriesService.findOne(id, cu.companyId!)
    }

    @Post()
    @Permission('inventory-category:create')
    create(@Body() dto: CreateStockCategoryDto, @CurrentUser() cu: AuthenticatedUser) {
        return this.categoriesService.create(dto, cu.companyId!)
    }

    @Patch(':id')
    @Permission('inventory-category:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateStockCategoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.categoriesService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('inventory-category:delete')
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
        return this.categoriesService.remove(id, cu.companyId!)
    }
}
