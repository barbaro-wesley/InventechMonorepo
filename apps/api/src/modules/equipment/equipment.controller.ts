import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
  HttpCode, HttpStatus, UseInterceptors,
  UploadedFiles, BadRequestException,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { EquipmentService } from './equipment.service'
import { CreateEquipmentDto, UpdateEquipmentDto, ListEquipmentsDto } from './dto/equipment.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ALLOWED_MIME_LIST } from '../storage/storage.constants'

@Controller('clients/:organizationId/equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @Permission('equipment:list')
  findAll(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() filters: ListEquipmentsDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findAll(organizationId, cu.tenantId!, filters)
  }

  @Get(':id')
  @Permission('equipment:read')
  findOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findOne(id, organizationId, cu.tenantId!)
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
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateEquipmentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.create(dto, organizationId, cu.tenantId!, cu, files ?? [])
  }

  @Patch(':id')
  @Permission('equipment:update')
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.update(id, dto, organizationId, cu.tenantId!)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('equipment:delete')
  remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.remove(id, organizationId, cu.tenantId!)
  }

  @Post(':id/depreciation')
  @HttpCode(HttpStatus.OK)
  @Permission('equipment:depreciation')
  recalculateDepreciation(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.recalculateDepreciation(id, organizationId, cu.tenantId!)
  }
}
