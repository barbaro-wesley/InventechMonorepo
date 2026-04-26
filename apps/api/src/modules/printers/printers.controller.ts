import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'
import { PrintersService } from './printers.service'
import { CreatePrinterDto, UpdatePrinterDto, ListPrintersDto } from './dto/printer.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  @Permission('printer:list')
  @ApiOperation({ summary: 'Listar impressoras da empresa' })
  findAll(
    @Query() filters: ListPrintersDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.printersService.findAll(cu, filters)
  }

  @Get(':id')
  @Permission('printer:read')
  @ApiOperation({ summary: 'Buscar impressora por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.printersService.findOne(id, cu)
  }

  @Post()
  @Permission('printer:create')
  @ApiOperation({ summary: 'Cadastrar nova impressora' })
  create(
    @Body() dto: CreatePrinterDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.printersService.create(dto, cu)
  }

  @Patch(':id')
  @Permission('printer:update')
  @ApiOperation({ summary: 'Atualizar impressora' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrinterDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.printersService.update(id, dto, cu)
  }

  @Delete(':id')
  @Permission('printer:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover impressora (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.printersService.remove(id, cu)
  }
}
