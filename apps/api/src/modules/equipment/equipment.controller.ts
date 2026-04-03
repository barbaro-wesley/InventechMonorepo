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

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @Permission('equipment:list')
  findAll(
    @Query() filters: ListEquipmentsDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findAll(cu.companyId!, filters)
  }

  @Get(':id')
  @Permission('equipment:read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.findOne(id, cu.companyId!)
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

  @Post(':id/depreciation')
  @HttpCode(HttpStatus.OK)
  @Permission('equipment:depreciation')
  recalculateDepreciation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.equipmentService.recalculateDepreciation(id, cu.companyId!)
  }
}
