import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, ParseUUIDPipe,
    HttpCode, HttpStatus,
} from '@nestjs/common'
import { AlertRulesService } from './alert-rules.service'
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto'
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto'
import { ListAlertRulesDto } from './dto/list-alert-rules.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('alert-rules')
export class AlertRulesController {
    constructor(private readonly alertRulesService: AlertRulesService) {}

    // Deve vir antes de :id para evitar que "meta" seja tratado como UUID
    @Get('meta/variables')
    getVariables() {
        return this.alertRulesService.getVariableRegistry()
    }

    @Get()
    @Permission('alert-rule:list')
    findAll(
        @Query() filters: ListAlertRulesDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.findAll(user.companyId!, filters)
    }

    @Get(':id')
    @Permission('alert-rule:read')
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.findOne(id, user.companyId!)
    }

    @Post()
    @Permission('alert-rule:create')
    create(
        @Body() dto: CreateAlertRuleDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.create(dto, user)
    }

    @Patch(':id')
    @Permission('alert-rule:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAlertRuleDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.update(id, dto, user.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Permission('alert-rule:delete')
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.remove(id, user.companyId!)
    }

    @Patch(':id/toggle')
    @Permission('alert-rule:update')
    toggleActive(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.toggleActive(id, user.companyId!)
    }

    @Post(':id/preview-email')
    @Permission('alert-rule:read')
    previewEmail(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { sampleData: Record<string, any> },
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.alertRulesService.previewEmail(id, body.sampleData, user.companyId!)
    }
}
