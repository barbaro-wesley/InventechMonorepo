import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Permission } from '../../common/decorators/permission.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ChecklistTemplatesService } from './checklist-templates.service'
import {
  CreateChecklistTemplateDto,
  ListChecklistTemplatesDto,
  UpdateChecklistTemplateDto,
} from './dto/checklist-template.dto'

@UseGuards(JwtAuthGuard)
@Controller('checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly service: ChecklistTemplatesService) {}

  @Post()
  @Permission('checklist-template:create')
  create(
    @Body() dto: CreateChecklistTemplateDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.create(dto, cu.companyId!, cu.sub, cu.clientId)
  }

  @Get()
  @Permission('checklist-template:list')
  findAll(
    @Query() filters: ListChecklistTemplatesDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.findAll(cu.companyId!, filters, cu.clientId)
  }

  @Get(':id')
  @Permission('checklist-template:read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.findOne(id, cu.companyId!, cu.clientId)
  }

  @Patch(':id')
  @Permission('checklist-template:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChecklistTemplateDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, cu.companyId!, cu.clientId)
  }

  @Post(':id/clone')
  @Permission('checklist-template:create')
  clone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.clone(id, cu.companyId!, cu.sub)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('checklist-template:delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.remove(id, cu.companyId!, cu.clientId)
  }
}
