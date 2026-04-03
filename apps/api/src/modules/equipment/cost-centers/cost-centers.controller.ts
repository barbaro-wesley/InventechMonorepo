import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query, ParseUUIDPipe,
    HttpCode, HttpStatus,
} from '@nestjs/common'
import { CostCentersService } from './cost-centers.service'
import { CreateCostCenterDto, UpdateCostCenterDto, ListCostCentersDto } from './dto/cost-center.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@Controller('cost-centers')
export class CostCentersController {
    constructor(private readonly costCentersService: CostCentersService) { }

    @Get()
    @Permission('cost-center:list')
    findAll(
        @Query() filters: ListCostCentersDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.findAll(currentUser.companyId!, filters)
    }

    @Get(':id')
    @Permission('cost-center:read')
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.findOne(id, currentUser.companyId!)
    }

    @Post()
    @Permission('cost-center:create')
    create(
        @Body() dto: CreateCostCenterDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.create(dto, currentUser.companyId!)
    }

    @Patch(':id')
    @Permission('cost-center:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCostCenterDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.update(id, dto, currentUser.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('cost-center:delete')
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.remove(id, currentUser.companyId!)
    }
}
