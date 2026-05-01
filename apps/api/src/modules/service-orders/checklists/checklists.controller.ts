import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { Permission } from '../../../common/decorators/permission.decorator'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { ChecklistsService } from './checklists.service'
import { CompleteChecklistDto, FillChecklistDto } from './dto/checklist.dto'

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/service-orders/:serviceOrderId/checklist')
export class ChecklistsController {
  constructor(private readonly service: ChecklistsService) {}

  @Get()
  @Permission('checklist:read')
  findOne(
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.findOne(serviceOrderId, cu)
  }

  @Patch('fill')
  @Permission('checklist:fill')
  fill(
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: FillChecklistDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.fill(serviceOrderId, dto, cu)
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @Permission('checklist:complete')
  complete(
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CompleteChecklistDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.complete(serviceOrderId, dto, cu)
  }

  @Post('reopen')
  @HttpCode(HttpStatus.OK)
  @Permission('checklist:reopen')
  reopen(
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.service.reopen(serviceOrderId, cu)
  }
}
