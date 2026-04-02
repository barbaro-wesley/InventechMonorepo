import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AttachmentEntity } from '@prisma/client'
import { StorageService } from './storage.service'
import { UploadFileDto } from './dto/storage.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ALLOWED_MIME_LIST } from './storage.constants'
import { RateLimit } from '../../common/decorators/rate-limit.decorator'

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) { }

  @Post('upload')
  @RateLimit({ limit: 30, ttl: 60, message: 'Limite de uploads atingido. Aguarde {{ttl}} segundos.' })
  @Permission('storage:upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_LIST.includes(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}`), false)
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado. Use o campo "file" no form-data.')
    }
    return this.storageService.upload(
      file,
      dto,
      currentUser.tenantId!,
      currentUser.organizationId,
      currentUser,
    )
  }

  // Upload de avatar — qualquer usuário autenticado (sem @Permission = aberto a autenticados)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true)
        else cb(new BadRequestException('Avatar deve ser uma imagem'), false)
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.')
    return this.storageService.uploadAvatar(file, currentUser.sub)
  }

  @Get(':id/url')
  @Permission('storage:download')
  getPresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.storageService.getPresignedUrl(id, currentUser.tenantId!)
  }

  @Get('entity/:entity/:entityId')
  @Permission('storage:list')
  listByEntity(
    @Param('entity') entity: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!Object.values(AttachmentEntity).includes(entity as AttachmentEntity)) {
      throw new BadRequestException(
        `Entidade inválida. Valores aceitos: ${Object.values(AttachmentEntity).join(', ')}`,
      )
    }
    return this.storageService.listByEntity(
      entity as AttachmentEntity,
      entityId,
      currentUser.tenantId!,
    )
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('storage:delete')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.storageService.delete(id, currentUser.tenantId!, currentUser)
  }
}
