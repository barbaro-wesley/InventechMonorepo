import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
  HttpCode, HttpStatus, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { OrganizationsService } from './organizations.service'
import { CreateClientDto } from './dto/create-organization.dto'
import { UpdateClientDto } from './dto/update-organization.dto'
import { ListClientsDto } from './dto/list-organizations.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@ApiTags('Clients')
@ApiBearerAuth('JWT')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) { }

  @Get()
  @Permission('client:list')
  findAll(@Query() filters: ListClientsDto, @CurrentUser() cu: AuthenticatedUser) {
    return this.organizationsService.findAll(cu, filters)
  }

  @Get(':id')
  @Permission('client:read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
    return this.organizationsService.findOne(id, cu)
  }

  @Post()
  @Permission('client:create')
  create(@Body() dto: CreateClientDto, @CurrentUser() cu: AuthenticatedUser) {
    return this.organizationsService.create(dto, cu)
  }

  @Patch(':id')
  @Permission('client:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.organizationsService.update(id, dto, cu)
  }

  // ─────────────────────────────────────────
  // POST /organizations/:id/logo
  // Upload do logo do cliente
  // ─────────────────────────────────────────
  @Post(':id/logo')
  @Permission('client:upload-logo')
  @ApiOperation({
    summary: 'Upload do logo do cliente',
    description: 'Salva o logo do cliente para uso nos relatórios. Aceita PNG, JPG, SVG (máx 2MB).',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
        if (allowed.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException('Logo deve ser PNG, JPG, WEBP ou SVG'), false)
      },
    }),
  )
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado. Use o campo "logo".')
    const logoUrl = await this.organizationsService.uploadLogo(id, file, cu)
    return { logoUrl, message: 'Logo do cliente atualizado com sucesso' }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('client:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() cu: AuthenticatedUser) {
    return this.organizationsService.remove(id, cu)
  }
}