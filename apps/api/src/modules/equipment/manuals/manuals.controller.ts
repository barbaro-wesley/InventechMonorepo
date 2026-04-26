import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, ParseUUIDPipe,
    HttpCode, HttpStatus, UseInterceptors,
    UploadedFile, BadRequestException, Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ManualsService } from './manuals.service'
import { CreateManualDto, UpdateManualDto } from './dto/manual.dto'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Permission } from '../../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { ManualType } from '@prisma/client'

@Controller('equipment/:equipmentId/manuals')
export class ManualsController {
    constructor(private readonly manualsService: ManualsService) {}

    @Get()
    @Permission('equipment-manual:list')
    findAll(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.manualsService.findAll(equipmentId, cu.companyId!)
    }

    @Get(':id')
    @Permission('equipment-manual:read')
    findOne(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.manualsService.findOne(equipmentId, id, cu.companyId!)
    }

    @Get(':id/download')
    @Permission('equipment-manual:read')
    async download(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
        @Res() res: Response,
    ) {
        const { stream, fileName } = await this.manualsService.downloadPdf(equipmentId, id, cu.companyId!)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)
        res.setHeader('Cache-Control', 'no-store')
        stream.pipe(res)
    }

    @Post()
    @Permission('equipment-manual:create')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 50 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                if (file.mimetype === 'application/pdf') {
                    cb(null, true)
                } else {
                    cb(new BadRequestException('Somente arquivos PDF são aceitos'), false)
                }
            },
        }),
    )
    create(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Body() dto: CreateManualDto,
        @UploadedFile() file: Express.Multer.File | undefined,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        if (dto.tipo === ManualType.PDF && !file) {
            throw new BadRequestException('Arquivo PDF é obrigatório para manuais do tipo PDF')
        }
        return this.manualsService.create(equipmentId, dto, cu.companyId!, cu, file)
    }

    @Patch(':id')
    @Permission('equipment-manual:update')
    update(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateManualDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.manualsService.update(equipmentId, id, dto, cu.companyId!)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permission('equipment-manual:delete')
    remove(
        @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.manualsService.remove(equipmentId, id, cu.companyId!, cu)
    }
}
