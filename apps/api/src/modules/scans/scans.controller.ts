import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiOperation } from '@nestjs/swagger'
import { ScansService } from './scans.service'
import { ListScansDto } from './dto/scan.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Get()
  @Permission('scan:list')
  @ApiOperation({ summary: 'Listar scans da empresa' })
  findAll(
    @Query() filters: ListScansDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.findAll(cu, filters)
  }

  @Get(':id')
  @Permission('scan:read')
  @ApiOperation({ summary: 'Buscar scan por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.findOne(id, cu)
  }

  @Get(':id/download')
  @Permission('scan:download')
  @ApiOperation({ summary: 'Gerar URL de download do scan (presigned, 1h)' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const url = await this.scansService.getDownloadUrl(id, cu)
    return res.redirect(url)
  }

  @Delete(':id')
  @Permission('scan:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover scan (arquivo + registro)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.scansService.remove(id, cu)
  }
}
