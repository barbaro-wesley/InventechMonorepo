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
import { StorageService } from '../storage/storage.service'
import {
  CreateServiceOrderDto, UpdateServiceOrderDto,
  UpdateServiceOrderStatusDto, AssignTechnicianDto,
  ListServiceOrdersDto, ListAvailableServiceOrdersDto,
} from './dto/service-order.dto'
import { CreateCommentDto, UpdateCommentDto } from './comments/dto/comment.dto'
import { CreateTaskDto, UpdateTaskDto, ReorderTasksDto } from './tasks/dto/task.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ALLOWED_MIME_LIST } from '../storage/storage.constants'

@Controller('clients/:organizationId/service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly commentsService: CommentsService,
    private readonly tasksService: TasksService,
    private readonly storageService: StorageService,
  ) { }

  @Get('available')
  @Permission('service-order:assume')
  findAvailable(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() filters: ListAvailableServiceOrdersDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.findAvailable(cu.tenantId!, filters, cu)
  }

  @Get()
  @Permission('service-order:list')
  findAll(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() filters: ListServiceOrdersDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.findAll(organizationId, cu.tenantId!, filters, cu)
  }

  @Get(':id')
  @Permission('service-order:read')
  findOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.findOne(id, organizationId, cu.tenantId!, cu)
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
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateServiceOrderDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    const os = await this.serviceOrdersService.create(dto, organizationId, cu.tenantId!, cu)
    if (files?.length > 0) {
      await Promise.all(
        files.map((file) =>
          this.storageService.upload(
            file,
            { entity: AttachmentEntity.SERVICE_ORDER, entityId: os.id },
            cu.tenantId!,
            organizationId,
            cu,
          ),
        ),
      )
    }
    return os
  }

  @Patch(':id')
  @Permission('service-order:update')
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.update(id, dto, organizationId, cu.tenantId!, cu)
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:update-status')
  updateStatus(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderStatusDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.updateStatus(id, dto, organizationId, cu.tenantId!, cu)
  }

  @Post(':id/assume')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:assume')
  assume(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.assumeServiceOrder(id, organizationId, cu.tenantId!, cu)
  }

  @Post(':id/technicians')
  @Permission('service-order:manage-techs')
  addTechnician(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.addTechnician(id, dto, organizationId, cu.tenantId!)
  }

  @Delete(':id/technicians/:technicianId')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:manage-techs')
  removeTechnician(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('technicianId', ParseUUIDPipe) technicianId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.serviceOrdersService.removeTechnician(id, technicianId, organizationId, cu.tenantId!)
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
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateCommentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    const comment = await this.commentsService.create(serviceOrderId, dto, organizationId, cu.tenantId!, cu)
    if (files?.length > 0) {
      await Promise.all(
        files.map((file) =>
          this.storageService.upload(
            file,
            { entity: AttachmentEntity.COMMENT, entityId: comment.id },
            cu.tenantId!,
            organizationId,
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
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.findAll(serviceOrderId, organizationId, cu.tenantId!)
  }

  @Post(':id/tasks')
  @Permission('service-order:task')
  createTask(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.create(serviceOrderId, dto, organizationId, cu.tenantId!)
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
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: ReorderTasksDto,
    @CurrentUser() cu: AuthenticatedUser,
  ) {
    return this.tasksService.reorder(serviceOrderId, dto, organizationId, cu.tenantId!)
  }

  @Delete(':osId/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @Permission('service-order:delete')
  removeTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.tasksService.remove(taskId)
  }
}
