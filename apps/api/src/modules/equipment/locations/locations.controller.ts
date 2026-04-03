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

@Controller('locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    @Permission('location:list')
    findAll(
        @Query() filters: ListLocationsDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findAll(currentUser.companyId!, filters)
    }

    @Get('tree')
    @Permission('location:list')
    findTree(
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findTree(currentUser.companyId!)
    }

    @Get(':id')
    @Permission('location:read')
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.findOne(id, currentUser.companyId!)
    }

    @Post()
    @Permission('location:create')
    create(
        @Body() dto: CreateLocationDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.create(dto, currentUser.companyId!)
    }

    @Patch(':id')
    @Permission('location:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLocationDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.update(id, dto, currentUser.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('location:delete')
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.locationsService.remove(id, currentUser.companyId!)
    }
}
