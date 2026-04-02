import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common'
import { LocationsService } from './locations.service'
import {
    CreateLocationDto,
    UpdateLocationDto,
    ListLocationsDto,
} from './dto/location.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'

@Controller('clients/:organizationId/locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    @Permission('location:list')
    findAll(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Query() filters: ListLocationsDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findAll(organizationId, currentUser.tenantId!, filters)
    }

    @Get('tree')
    @Permission('location:list')
    findTree(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findTree(organizationId, currentUser.tenantId!)
    }

    @Get(':id')
    @Permission('location:read')
    findOne(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findOne(id, organizationId, currentUser.tenantId!)
    }

    @Post()
    @Permission('location:create')
    create(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Body() dto: CreateLocationDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.create(dto, organizationId, currentUser.tenantId!)
    }

    @Patch(':id')
    @Permission('location:update')
    update(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLocationDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.update(id, dto, organizationId, currentUser.tenantId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('location:delete')
    remove(
        @Param('organizationId', ParseUUIDPipe) organizationId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.remove(id, organizationId, currentUser.tenantId!)
    }
}
