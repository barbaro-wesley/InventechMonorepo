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

@Controller('clients/:clientId/locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    @Permission('location:list')
    findAll(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Query() filters: ListLocationsDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findAll(clientId, currentUser.companyId!, filters)
    }

    @Get('tree')
    @Permission('location:list')
    findTree(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findTree(clientId, currentUser.companyId!)
    }

    @Get(':id')
    @Permission('location:read')
    findOne(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findOne(id, clientId, currentUser.companyId!)
    }

    @Post()
    @Permission('location:create')
    create(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() dto: CreateLocationDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.create(dto, clientId, currentUser.companyId!)
    }

    @Patch(':id')
    @Permission('location:update')
    update(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLocationDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.update(id, dto, clientId, currentUser.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('location:delete')
    remove(
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.remove(id, clientId, currentUser.companyId!)
    }
}
