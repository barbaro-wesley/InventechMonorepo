import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
  HttpCode, HttpStatus, UseInterceptors,
  UploadedFiles, BadRequestException,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { AttachmentEntity } from '@prisma/client'
import { ServiceOrdersService } from './service-orders.service'
import { CommentsService } from './comments/comments.service'
import { TasksService } from './tasks/tasks.service'
import { CostsService } from './costs/costs.service'
import { StorageService } from '../storage/storage.service'
import {
  CreateServiceOrderDto, UpdateServiceOrderDto,
  UpdateServiceOrderStatusDto, AssignTechnicianDto,
  ListServiceOrdersDto, ListAvailableServiceOrdersDto,
} from './dto/service-order.dto'
import { CreateCommentDto, UpdateCommentDto } from './comments/dto/comment.dto'
import { CreateTaskDto, UpdateTaskDto, ReorderTasksDto } from './tasks/dto/task.dto'
import { CreateCostItemDto, UpdateCostItemDto } from './costs/dto/cost.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ALLOWED_MIME_LIST } from '../storage/storage.constants'

@Controller('clients/:clientId/service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly commentsService: CommentsService,
    private readonly tasksService: TasksService,
    private readonly costsService: CostsService,
    private readonly storageService: StorageService,
  ) { }

  @Get('available')
  @Permission('service-order:assume')
  findAvailable(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() filters: ListAvailableServiceOrdersDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.findAvailable(cu.companyId!, filters, cu)
  }

  @Get()
  @Permission('service-order:list')
  findAll(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() filters: ListServiceOrdersDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.findAll(clientId, cu.companyId!, filters, cu)
  }

  @Get(':id')
  @Permission('service-order:read')
  findOne(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.findOne(id, clientId, cu.companyId!, cu)
  }

  @Post()
  @Permission('service-order:create')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_LIST.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException(`Tipo não permitido: ${file.mimetype}`), false)
      },
    }),
  )
  async create(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateServiceOrderDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    const os = await this.serviceOrdersService.create(dto, clientId, cu.companyId!, cu)
    if (files?.length > 0) {
      await Promise.all(
        files.map((file) =>
          this.storageService.upload(
            file,
            { entity: AttachmentEntity.SERVICE_ORDER, entityId: os.id },
            cu.companyId!,
            clientId,
            cu,
          ),
        ),
      )
    }
    return os
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:delete')
  remove(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.remove(id, clientId, cu.companyId!)
  }

  @Patch(':id')
  @Permission('service-order:update')
  update(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.update(id, dto, clientId, cu.companyId!, cu)
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:update-status')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_LIST.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException(`Tipo não permitido: ${file.mimetype}`), false)
      },
    }),
  )
  async updateStatus(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderStatusDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    const os = await this.serviceOrdersService.updateStatus(id, dto, clientId, cu.companyId!, cu)
    if (files?.length > 0) {
      await Promise.all(
        files.map((file) =>
          this.storageService.upload(
            file,
            { entity: AttachmentEntity.SERVICE_ORDER, entityId: os.id },
            cu.companyId!,
            clientId,
            cu,
          ),
        ),
      )
    }
    return os
  }

  @Post(':id/assume')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:assume')
  assume(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.assumeServiceOrder(id, clientId, cu.companyId!, cu)
  }

  @Post(':id/technicians')
  @Permission('service-order:manage-techs')
  addTechnician(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.addTechnician(id, dto, clientId, cu.companyId!)
  }

  @Delete(':id/technicians/:technicianId')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:manage-techs')
  removeTechnician(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('technicianId', ParseUUIDPipe) technicianId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.removeTechnician(id, technicianId, clientId, cu.companyId!)
  }

  @Post(':id/comments')
  @Permission('service-order:comment')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_LIST.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException(`Tipo não permitido: ${file.mimetype}`), false)
      },
    }),
  )
  async createComment(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateCommentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    const comment = await this.commentsService.create(serviceOrderId, dto, clientId, cu.companyId!, cu)
    if (files?.length > 0) {
      await Promise.all(
        files.map((file) =>
          this.storageService.upload(
            file,
            { entity: AttachmentEntity.COMMENT, entityId: comment.id },
            cu.companyId!,
            clientId,
            cu,
          ),
        ),
      )
    }
    return comment
  }

  @Patch(':osId/comments/:commentId')
  @Permission('service-order:comment')
  updateComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.commentsService.update(commentId, dto, cu)
  }

  @Delete(':osId/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:comment')
  removeComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.commentsService.remove(commentId, cu)
  }

  @Get(':id/tasks')
  @Permission('service-order:list')
  findTasks(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.findAll(serviceOrderId, clientId, cu.companyId!)
  }

  @Post(':id/tasks')
  @Permission('service-order:task')
  createTask(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.create(serviceOrderId, dto, clientId, cu.companyId!)
  }

  @Patch(':osId/tasks/:taskId')
  @Permission('service-order:task')
  updateTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.update(taskId, dto, cu)
  }

  @Patch(':id/tasks/reorder')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:task')
  reorderTasks(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: ReorderTasksDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.reorder(serviceOrderId, dto, clientId, cu.companyId!)
  }

  @Delete(':osId/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:delete')
  removeTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.tasksService.remove(taskId)
  }

  // ── Custos ──────────────────────────────────────────────────────────────

  @Get(':id/costs')
  @Permission('service-order:read')
  findCosts(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.costsService.findAll(serviceOrderId, clientId, cu.companyId!)
  }

  @Post(':id/costs')
  @Permission('service-order:update')
  createCost(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateCostItemDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.costsService.create(serviceOrderId, dto, clientId, cu.companyId!)
  }

  @Patch(':osId/costs/:costId')
  @Permission('service-order:update')
  updateCost(
    @Param('costId', ParseUUIDPipe) costId: string,
    @Body() dto: UpdateCostItemDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.costsService.update(costId, dto, cu.companyId!)
  }

  @Delete(':osId/costs/:costId')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:update')
  removeCost(
    @Param('costId', ParseUUIDPipe) costId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.costsService.remove(costId, cu.companyId!)
  }
}
