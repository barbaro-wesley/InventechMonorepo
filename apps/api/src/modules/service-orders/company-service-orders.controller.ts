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
    ListServiceOrdersDto,
    UpdateServiceOrderDto,
    UpdateServiceOrderStatusDto,
    AssignTechnicianDto,
} from './dto/service-order.dto'
import { CreateCommentDto } from './comments/dto/comment.dto'
import { CreateTaskDto, UpdateTaskDto, ReorderTasksDto } from './tasks/dto/task.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Permission } from '../../common/decorators/permission.decorator'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { ALLOWED_MIME_LIST } from '../storage/storage.constants'

// Visão company-wide para o painel operacional — sem clientId na rota
@Controller('service-orders')
export class CompanyServiceOrdersController {
    constructor(
        private readonly serviceOrdersService: ServiceOrdersService,
        private readonly commentsService: CommentsService,
        private readonly tasksService: TasksService,
        private readonly storageService: StorageService,
    ) { }

    @Get()
    @Permission('service-order:list')
    findAll(
        @Query() filters: ListServiceOrdersDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.findAllForCompany(cu.companyId!, filters, cu)
    }

    @Get('mine')
    @Permission('service-order:view-own')
    findMine(
        @Query() filters: ListServiceOrdersDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.findMine(cu.companyId!, filters, cu)
    }

    @Get('my-stats')
    @Permission('service-order:view-own')
    getMyStats(@CurrentUser() cu: AuthenticatedUser) {
        return this.serviceOrdersService.findMyStats(cu.companyId!, cu.sub)
    }

    @Get(':id')
    @Permission('service-order:read')
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.findOne(id, null, cu.companyId!, cu)
    }

    @Patch(':id')
    @Permission('service-order:update')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateServiceOrderDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.update(id, dto, null, cu.companyId!, cu)
    }

    @Patch(':id/status')
    @HttpCode(HttpStatus.OK)
    @Permission('service-order:update-status')
    updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateServiceOrderStatusDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.updateStatus(id, dto, null, cu.companyId!, cu)
    }

    @Post(':id/assume')
    @HttpCode(HttpStatus.OK)
    @Permission('service-order:assume')
    assume(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.assumeServiceOrder(id, null, cu.companyId!, cu)
    }

    @Post(':id/technicians')
    @Permission('service-order:manage-techs')
    addTechnician(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignTechnicianDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.addTechnician(id, dto, null, cu.companyId!)
    }

    @Delete(':id/technicians/:technicianId')
    @HttpCode(HttpStatus.OK)
    @Permission('service-order:manage-techs')
    removeTechnician(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('technicianId', ParseUUIDPipe) technicianId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.serviceOrdersService.removeTechnician(id, technicianId, null, cu.companyId!)
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
        @Param('id', ParseUUIDPipe) serviceOrderId: string,
        @Body() dto: CreateCommentDto,
        @UploadedFiles() files: Express.Multer.File[],
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        const comment = await this.commentsService.create(serviceOrderId, dto, null, cu.companyId!, cu)
        if (files?.length > 0) {
            await Promise.all(
                files.map((file) =>
                    this.storageService.upload(
                        file,
                        { entity: AttachmentEntity.COMMENT, entityId: comment.id },
                        cu.companyId!,
                        null,
                        cu,
                    ),
                ),
            )
        }
        return comment
    }

    @Get(':id/tasks')
    @Permission('service-order:list')
    findTasks(
        @Param('id', ParseUUIDPipe) serviceOrderId: string,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.tasksService.findAll(serviceOrderId, null, cu.companyId!)
    }

    @Post(':id/tasks')
    @Permission('service-order:task')
    createTask(
        @Param('id', ParseUUIDPipe) serviceOrderId: string,
        @Body() dto: CreateTaskDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.tasksService.create(serviceOrderId, dto, null, cu.companyId!)
    }

    @Patch(':id/tasks/reorder')
    @HttpCode(HttpStatus.OK)
    @Permission('service-order:task')
    reorderTasks(
        @Param('id', ParseUUIDPipe) serviceOrderId: string,
        @Body() dto: ReorderTasksDto,
        @CurrentUser() cu: AuthenticatedUser,
    ) {
        return this.tasksService.reorder(serviceOrderId, dto, null, cu.companyId!)
    }
}
