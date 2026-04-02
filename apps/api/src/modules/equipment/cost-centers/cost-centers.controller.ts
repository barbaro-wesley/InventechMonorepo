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

@Controller('clients/:organizationId/cost-centers')
export class CostCentersController {
    constructor(private readonly costCentersService: CostCentersService) { }

    @Get()
    @Permission('cost-center:list')
    findAll(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Query() filters: ListCostCentersDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.findAll(organizationId, currentUser.tenantId!, filters)
    }

    @Get(':id')
    @Permission('cost-center:read')
    findOne(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.findOne(id, organizationId, currentUser.tenantId!)
    }

    @Post()
    @Permission('cost-center:create')
    create(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Body() dto: CreateCostCenterDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.create(dto, organizationId, currentUser.tenantId!)
    }

    @Patch(':id')
    @Permission('cost-center:update')
    update(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCostCenterDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.update(id, dto, organizationId, currentUser.tenantId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('cost-center:delete')
    remove(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.costCentersService.remove(id, organizationId, currentUser.tenantId!)
    }
}
