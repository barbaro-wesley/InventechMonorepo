import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
  HttpCode, HttpStatus, UseInterceptors,
  UploadedFiles, BadRequestException, Res
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiOperation } from '@nestjs/swagger'
import { FilesInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { EquipmentService } from './equipment.service'
import { CreateEquipmentDto, UpdateEquipmentDto, ListEquipmentsDto, ListEquipmentServiceOrdersDto } from './dto/equipment.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ALLOWED_MIME_LIST } from '../storage/storage.constants'

import { ReportsService } from '../reports/reports.service'

@Controller('equipment')
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly reportsService: ReportsService
  ) {}

  @Get()
  @Permission('equipment:list')
  findAll(
    @Query() filters: ListEquipmentsDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findAll(cu, filters)
  }

  @Get(':id')
  @Permission('equipment:read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findOne(id, cu)
  }

  @Post()
  @Permission('equipment:create')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_LIST.includes(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}`), false)
        }
      },
    }),
  )
  create(
    @Body() dto: CreateEquipmentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.create(dto, cu.companyId!, cu, files ?? [])
  }

  @Patch(':id')
  @Permission('equipment:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.update(id, dto, cu.companyId!)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('equipment:delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.remove(id, cu.companyId!)
  }

  @Get(':id/service-orders')
  @Permission('equipment:read')
  findServiceOrders(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: ListEquipmentServiceOrdersDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findServiceOrders(id, cu, filters)
  }

  @Post(':id/depreciation')
  @HttpCode(HttpStatus.OK)
  @Permission('equipment:depreciation')
  recalculateDepreciation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.recalculateDepreciation(id, cu.companyId!)
  }

  @Get(':id/lifecycle-pdf')
  @ApiOperation({ summary: 'Exportar Ficha de Vida do equipamento em PDF' })
  @Permission('equipment:read')
  async exportLifeCyclePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportEquipmentLifeCyclePdf(cu.companyId!, id)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Ficha_Vida_Equipamento_${id}.pdf"`,
      'Content-Length': buffer.length,
    })
    res.end(buffer)
  }
}
