import {
    Controller, Get, Post, Body, Param, Patch, Delete,
    ParseUUIDPipe, Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { AccessoriesService } from './accessories.service'
import { CreateAccessoryDto, UpdateAccessoryDto, ListAccessoriesDto } from './dto/accessory.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@ApiTags('Accessories')
@Controller('accessories')
export class AccessoriesController {
    constructor(private readonly accessoriesService: AccessoriesService) { }

    @Get()
    @Permission('accessories:read')
    @ApiOperation({ summary: 'Listar acessórios com filtros e paginação' })
    findAll(
        @CurrentUser() cu: AuthenticatedUser,
        @Query() filters: ListAccessoriesDto,
    ) {
        return this.accessoriesService.findAll(cu, filters)
    }

    @Get(':id')
    @Permission('accessories:read')
    @ApiOperation({ summary: 'Detalhe de um acessório' })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.accessoriesService.findOne(id, cu)
    }

    @Get(':id/history')
    @Permission('accessories:read')
    @ApiOperation({ summary: 'Timeline completa: status, vínculos, movimentações, manutenções' })
    findHistory(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.accessoriesService.findHistory(id, cu.companyId!)
    }

    @Post()
    @Permission('accessories:create')
    @ApiOperation({ summary: 'Criar acessório' })
    create(
        @Body() dto: CreateAccessoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.accessoriesService.create(dto, cu.companyId!, cu)
    }

    @Patch(':id')
    @Permission('accessories:update')
    @ApiOperation({ summary: 'Atualizar dados do acessório' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAccessoryDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.accessoriesService.update(id, dto, cu.companyId!)
    }

    @Delete(':id')
    @Permission('accessories:delete')
    @ApiOperation({ summary: 'Remover acessório (soft delete)' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.accessoriesService.remove(id, cu.companyId!)
    }
}
