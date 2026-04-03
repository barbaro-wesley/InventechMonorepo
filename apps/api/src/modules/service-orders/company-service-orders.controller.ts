import { Controller, Get, Query } from '@nestjs/common'
import { ServiceOrdersService } from './service-orders.service'
import { ListServiceOrdersDto } from './dto/service-order.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

// Visão company-wide para o painel operacional — sem clientId na rota
@Controller('service-orders')
export class CompanyServiceOrdersController {
    constructor(private readonly serviceOrdersService: ServiceOrdersService) { }

    @Get()
    @Permission('service-order:list')
    findAll(
        @Query() filters: ListServiceOrdersDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.findAllForCompany(cu.companyId!, filters, cu)
    }
}
