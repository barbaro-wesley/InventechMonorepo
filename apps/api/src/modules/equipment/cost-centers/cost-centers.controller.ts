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

@Controller('clients/:clientId/cost-centers')
export class CostCentersController {
    constructor(private readonly costCentersService: CostCentersService) { }

    @Get()
    @Permission('cost-center:list')
    findAll(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Query() filters: ListCostCentersDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.findAll(clientId, currentUser.companyId!, filters)
    }

    @Get(':id')
    @Permission('cost-center:read')
    findOne(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.findOne(id, clientId, currentUser.companyId!)
    }

    @Post()
    @Permission('cost-center:create')
    create(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() dto: CreateCostCenterDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.create(dto, clientId, currentUser.companyId!)
    }

    @Patch(':id')
    @Permission('cost-center:update')
    update(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCostCenterDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.update(id, dto, clientId, currentUser.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('cost-center:delete')
    remove(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.remove(id, clientId, currentUser.companyId!)
    }
}
