import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { Prisma, RecurrenceType, ServiceOrderStatus, ServiceOrderTechnicianRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import {
    CreateMaintenanceDto,
    UpdateMaintenanceDto,
    ListMaintenancesDto,
    CreateScheduleDto,
    UpdateScheduleDto,
    ListSchedulesDto,
} from './dto/maintenance.dto'
import { calculateNextRunAt } from './schedule/recurrence.util'

export const MAINTENANCE_QUEUE = 'maintenance'

export const MAINTENANCE_JOBS = {
    GENERATE_PREVENTIVE: 'generate-preventive-os',
    SEND_UNASSIGNED_ALERT: 'send-unassigned-alert',
} as const

const MAINTENANCE_SELECT = {
    id: true,
    tenantId: true,
    organizationId: true,
    type: true,
    title: true,
    description: true,
    scheduledAt: true,
    startedAt: true,
    completedAt: true,
    observations: true,
    createdAt: true,
    equipment: { select: { id: true, name: true, brand: true, model: true } },
    technician: { select: { id: true, name: true } },
    schedule: { select: { id: true, title: true, recurrenceType: true } },
} satisfies Prisma.MaintenanceSelect

const SCHEDULE_SELECT = {
    id: true,
    tenantId: true,
    organizationId: true,
    title: true,
    description: true,
    maintenanceType: true,
    recurrenceType: true,
    customIntervalDays: true,
    estimatedDurationMin: true,
    startDate: true,
    endDate: true,
    nextRunAt: true,
    lastRunAt: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    equipment: { select: { id: true, name: true } },
    group: { select: { id: true, name: true, color: true } },
    _count: { select: { maintenances: true } },
} satisfies Prisma.MaintenanceScheduleSelect

@Injectable()
export class MaintenanceService {
    private readonly logger = new Logger(MaintenanceService.name)

    constructor(
        private prisma: PrismaService,
        @InjectQueue(MAINTENANCE_QUEUE) private maintenanceQueue: Queue,
    ) { }

    // ─────────────────────────────────────────
    // MANUTENÇÕES
    // ─────────────────────────────────────────

    async findAllMaintenances(
        organizationId: string,
        tenantId: string,
        filters: ListMaintenancesDto,
    ) {
        const { type, equipmentId, technicianId, dateFrom, dateTo, page = 1, limit = 20 } = filters

        const where: Prisma.MaintenanceWhereInput = {
            organizationId,
            tenantId,
            ...(type && { type }),
            ...(equipmentId && { equipmentId }),
            ...(technicianId && { technicianId }),
            ...((dateFrom || dateTo) && {
                scheduledAt: {
                    ...(dateFrom && { gte: new Date(dateFrom) }),
                    ...(dateTo && { lte: new Date(dateTo) }),
                },
            }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.maintenance.findMany({
                where,
                select: MAINTENANCE_SELECT,
                orderBy: { scheduledAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.maintenance.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findOneMaintenance(id: string, organizationId: string, tenantId: string) {
        const maintenance = await this.prisma.maintenance.findFirst({
            where: { id, organizationId, tenantId },
            select: MAINTENANCE_SELECT,
        })
        if (!maintenance) throw new NotFoundException('Manutenção não encontrada')
        return maintenance
    }

    async createMaintenance(
        dto: CreateMaintenanceDto,
        organizationId: string,
        tenantId: string,
        currentUser: AuthenticatedUser,
    ) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: dto.equipmentId, organizationId, tenantId, deletedAt: null },
            select: { id: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        return this.prisma.maintenance.create({
            data: {
                tenantId,
                organizationId,
                type: dto.type,
                title: dto.title,
                description: dto.description,
                observations: dto.observations,
                scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
                equipmentId: dto.equipmentId,
                ...(dto.technicianId && {
                    technicianId: dto.technicianId,
                }),
            },
            select: MAINTENANCE_SELECT,
        })
    }

    async updateMaintenance(
        id: string,
        dto: UpdateMaintenanceDto,
        organizationId: string,
        tenantId: string,
    ) {
        const existing = await this.prisma.maintenance.findFirst({
            where: { id, organizationId, tenantId },
            select: { id: true },
        })
        if (!existing) throw new NotFoundException('Manutenção não encontrada')

        return this.prisma.maintenance.update({
            where: { id },
            data: {
                ...(dto.title && { title: dto.title }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.observations !== undefined && { observations: dto.observations }),
                ...(dto.scheduledAt !== undefined && {
                    scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
                }),
                ...(dto.startedAt !== undefined && {
                    startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
                }),
                ...(dto.completedAt !== undefined && {
                    completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
                }),
                ...(dto.technicianId !== undefined && {
                    technician: dto.technicianId
                        ? { connect: { id: dto.technicianId } }
                        : { disconnect: true },
                }),
            },
            select: MAINTENANCE_SELECT,
        })
    }

    // ─────────────────────────────────────────
    // AGENDAMENTOS (SCHEDULES)
    // ─────────────────────────────────────────

    async findAllSchedules(
        organizationId: string,
        tenantId: string,
        filters: ListSchedulesDto,
    ) {
        const { equipmentId, recurrenceType, isActive, page = 1, limit = 20 } = filters

        const where: Prisma.MaintenanceScheduleWhereInput = {
            organizationId,
            tenantId,
            ...(equipmentId && { equipmentId }),
            ...(recurrenceType && { recurrenceType }),
            ...(isActive !== undefined && { isActive }),
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.maintenanceSchedule.findMany({
                where,
                select: SCHEDULE_SELECT,
                orderBy: { nextRunAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.maintenanceSchedule.count({ where }),
        ])

        return { data, total, page, limit }
    }

    async findOneSchedule(id: string, organizationId: string, tenantId: string) {
        const schedule = await this.prisma.maintenanceSchedule.findFirst({
            where: { id, organizationId, tenantId },
            select: SCHEDULE_SELECT,
        })
        if (!schedule) throw new NotFoundException('Agendamento não encontrado')
        return schedule
    }

    async createSchedule(
        dto: CreateScheduleDto,
        organizationId: string,
        tenantId: string,
        currentUser: AuthenticatedUser,
    ) {
        // Valida customIntervalDays para recorrência CUSTOM
        if (dto.recurrenceType === RecurrenceType.CUSTOM && !dto.customIntervalDays) {
            throw new BadRequestException(
                'customIntervalDays é obrigatório para recorrência CUSTOM',
            )
        }

        // Valida equipamento
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: dto.equipmentId, organizationId, tenantId, deletedAt: null },
            select: { id: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')

        const startDate = new Date(dto.startDate)

        // Primeira execução = startDate
        const nextRunAt = startDate < new Date()
            ? calculateNextRunAt(dto.recurrenceType, new Date(), dto.customIntervalDays)
            : startDate

        const schedule = await this.prisma.maintenanceSchedule.create({
            data: {
                tenantId,
                organizationId,
                title: dto.title,
                description: dto.description,
                maintenanceType: dto.maintenanceType,
                recurrenceType: dto.recurrenceType,
                customIntervalDays: dto.customIntervalDays,
                estimatedDurationMin: dto.estimatedDurationMin,
                startDate,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                nextRunAt,
                equipmentId: dto.equipmentId,        // ✅ ID direto
                // ✅ Remove organization: { connect } — organizationId já está acima
                ...(dto.groupId && { groupId: dto.groupId }), // ✅ ID direto
                ...(dto.assignedTechnicianId && {
                    assignedTechnicianId: dto.assignedTechnicianId,
                }),
            },
            select: SCHEDULE_SELECT,
        })

        this.logger.log(
            `Schedule criado: ${schedule.title} | ` +
            `Próxima execução: ${nextRunAt.toISOString()}`,
        )

        return schedule
    }

    async updateSchedule(
        id: string,
        dto: UpdateScheduleDto,
        organizationId: string,
        tenantId: string,
    ) {
        const existing = await this.prisma.maintenanceSchedule.findFirst({
            where: { id, organizationId, tenantId },
            select: { id: true, recurrenceType: true, customIntervalDays: true },
        })
        if (!existing) throw new NotFoundException('Agendamento não encontrado')

        const recurrenceType = dto.recurrenceType ?? existing.recurrenceType
        const customIntervalDays = dto.customIntervalDays ?? existing.customIntervalDays

        if (recurrenceType === RecurrenceType.CUSTOM && !customIntervalDays) {
            throw new BadRequestException('customIntervalDays é obrigatório para recorrência CUSTOM')
        }

        // Recalcula nextRunAt se recorrência mudar
        const nextRunAt = dto.recurrenceType
            ? calculateNextRunAt(dto.recurrenceType, new Date(), customIntervalDays ?? undefined)
            : undefined

        return this.prisma.maintenanceSchedule.update({
            where: { id },
            data: {
                ...(dto.title && { title: dto.title }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.recurrenceType && { recurrenceType: dto.recurrenceType }),
                ...(dto.customIntervalDays !== undefined && { customIntervalDays: dto.customIntervalDays }),
                ...(dto.estimatedDurationMin !== undefined && { estimatedDurationMin: dto.estimatedDurationMin }),
                ...(dto.endDate !== undefined && {
                    endDate: dto.endDate ? new Date(dto.endDate) : null,
                }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                ...(nextRunAt && { nextRunAt }),
                ...(dto.assignedTechnicianId !== undefined && {
                    assignedTechnicianId: dto.assignedTechnicianId,
                }),
                ...(dto.groupId !== undefined && {
                    group: dto.groupId
                        ? { connect: { id: dto.groupId } }
                        : { disconnect: true },
                }),
            },
            select: SCHEDULE_SELECT,
        })
    }

    async removeSchedule(id: string, organizationId: string, tenantId: string) {
        const schedule = await this.prisma.maintenanceSchedule.findFirst({
            where: { id, organizationId, tenantId },
            select: { id: true, title: true },
        })
        if (!schedule) throw new NotFoundException('Agendamento não encontrado')

        // Desativa em vez de deletar — preserva histórico
        await this.prisma.maintenanceSchedule.update({
            where: { id },
            data: { isActive: false },
        })

        return { message: `Agendamento "${schedule.title}" desativado com sucesso` }
    }

    // ─────────────────────────────────────────
    // Dispara manualmente a geração de OS
    // preventivas (útil para testes)
    // ─────────────────────────────────────────
    async triggerGeneration() {
        const job = await this.maintenanceQueue.add(
            MAINTENANCE_JOBS.GENERATE_PREVENTIVE,
            {},
            { priority: 1 },
        )
        return { message: 'Geração iniciada', jobId: job.id }
    }

    // ─────────────────────────────────────────
    // Método interno chamado pelo processor
    // Gera OS preventivas para schedules vencidos
    // ─────────────────────────────────────────
    async generatePreventiveOrders(): Promise<number> {
        const now = new Date()

        // Busca todos os schedules ativos com nextRunAt <= agora
        const dueSchedules = await this.prisma.maintenanceSchedule.findMany({
            where: {
                isActive: true,
                nextRunAt: { lte: now },
                // Respeita endDate se definido
                OR: [
                    { endDate: null },
                    { endDate: { gte: now } },
                ],
            },
            select: {
                id: true,
                tenantId: true,
                organizationId: true,
                title: true,
                description: true,
                maintenanceType: true,
                recurrenceType: true,
                customIntervalDays: true,
                assignedTechnicianId: true,
                groupId: true,
                equipmentId: true,
            },
        })

        if (dueSchedules.length === 0) {
            this.logger.debug('Nenhum schedule vencido encontrado')
            return 0
        }

        this.logger.log(`Gerando OS para ${dueSchedules.length} schedule(s) vencido(s)`)

        let generated = 0

        for (const schedule of dueSchedules) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    // Número sequencial da OS
                    const last = await tx.serviceOrder.findFirst({
                        where: { tenantId: schedule.tenantId },
                        orderBy: { number: 'desc' },
                        select: { number: true },
                    })
                    const number = (last?.number ?? 0) + 1

                    const isAvailable = !schedule.assignedTechnicianId
                    const status = isAvailable
                        ? ServiceOrderStatus.AWAITING_PICKUP
                        : ServiceOrderStatus.OPEN

                    // Cria a OS
                    const os = await tx.serviceOrder.create({
                        data: {
                            tenantId: schedule.tenantId,
                            organizationId: schedule.organizationId,
                            equipmentId: schedule.equipmentId,
                            number,
                            title: `[PREVENTIVA] ${schedule.title}`,
                            description: schedule.description ?? `Manutenção preventiva gerada automaticamente`,
                            maintenanceType: schedule.maintenanceType,
                            status,
                            isAvailable,
                            alertAfterHours: 4,
                            priority: 'MEDIUM',
                            // ✅ Troca o objeto connect por ID direto
                            requesterId: await this.getCompanyAdminId(schedule.tenantId, tx),
                            // ✅ Remove equipment: { connect } — equipmentId já está acima
                            ...(schedule.groupId && {
                                groupId: schedule.groupId, // ✅ Usa ID direto também
                            }),
                        },
                        select: { id: true, number: true },
                    })
                    // Vincula técnico se definido
                    if (schedule.assignedTechnicianId) {
                        await tx.serviceOrderTechnician.create({
                            data: {
                                serviceOrderId: os.id,
                                technicianId: schedule.assignedTechnicianId,
                                role: ServiceOrderTechnicianRole.LEAD,
                            },
                        })
                    }

                    // Histórico inicial
                    await tx.serviceOrderStatusHistory.create({
                        data: {
                            serviceOrderId: os.id,
                            toStatus: status,
                            changedById: await this.getCompanyAdminId(schedule.tenantId, tx),
                            reason: `Gerada automaticamente pelo agendamento "${schedule.title}"`,
                        },
                    })

                    // Cria registro de manutenção vinculado à OS
                    await tx.maintenance.create({
                        data: {
                            tenantId: schedule.tenantId,
                            organizationId: schedule.organizationId,
                            equipmentId: schedule.equipmentId,
                            scheduleId: schedule.id,
                            type: schedule.maintenanceType,
                            title: schedule.title,
                            description: schedule.description,
                            ...(schedule.assignedTechnicianId && {
                                technicianId: schedule.assignedTechnicianId,
                            }),
                        },
                    })

                    // Atualiza nextRunAt e lastRunAt do schedule
                    const nextRunAt = calculateNextRunAt(
                        schedule.recurrenceType,
                        now,
                        schedule.customIntervalDays ?? undefined,
                    )

                    await tx.maintenanceSchedule.update({
                        where: { id: schedule.id },
                        data: { lastRunAt: now, nextRunAt },
                    })

                    this.logger.log(
                        `OS #${number} preventiva gerada | Schedule: ${schedule.title} | ` +
                        `Próxima: ${nextRunAt.toISOString()}`,
                    )
                })

                generated++

                // Enfileira notificação para cada OS gerada
                await this.maintenanceQueue.add(
                    'notify-preventive-generated',
                    { scheduleId: schedule.id, tenantId: schedule.tenantId },
                    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
                )
            } catch (error) {
                this.logger.error(
                    `Erro ao gerar OS para schedule ${schedule.id}: ${error.message}`,
                )
            }
        }

        return generated
    }

    // ─────────────────────────────────────────
    // Verifica OS sem assumir e envia alertas
    // ─────────────────────────────────────────
    async checkUnassignedAlerts(): Promise<void> {
        const now = new Date()

        // Busca OS no painel que passaram do prazo de alerta
        const overdueOS = await this.prisma.serviceOrder.findMany({
            where: {
                isAvailable: true,
                status: ServiceOrderStatus.AWAITING_PICKUP,
                alertSentAt: null,         // Alerta ainda não enviado
                deletedAt: null,
                // nextRunAt: overdue calculado via alertAfterHours
            },
            select: {
                id: true,
                number: true,
                title: true,
                tenantId: true,
                organizationId: true,
                groupId: true,
                alertAfterHours: true,
                createdAt: true,
            },
        })

        for (const os of overdueOS) {
            if (!os.alertAfterHours) continue

            const alertTime = new Date(os.createdAt)
            alertTime.setHours(alertTime.getHours() + os.alertAfterHours)

            if (now >= alertTime) {
                // Enfileira alerta
                await this.maintenanceQueue.add(
                    MAINTENANCE_JOBS.SEND_UNASSIGNED_ALERT,
                    {
                        serviceOrderId: os.id,
                        number: os.number,
                        title: os.title,
                        tenantId: os.tenantId,
                        groupId: os.groupId,
                    },
                    { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
                )

                // Marca como alerta enviado
                await this.prisma.serviceOrder.update({
                    where: { id: os.id },
                    data: { alertSentAt: now },
                })

                this.logger.warn(
                    `Alerta de OS não assumida: OS #${os.number} — "${os.title}"`,
                )
            }
        }
    }

    // ─────────────────────────────────────────
    // Helper: ID do primeiro admin da empresa
    // ─────────────────────────────────────────
    private async getCompanyAdminId(tenantId: string, tx: any): Promise<string> {
        const admin = await tx.user.findFirst({
            where: { tenantId, role: 'COMPANY_ADMIN', deletedAt: null },
            select: { id: true },
        })
        if (!admin) throw new Error(`COMPANY_ADMIN não encontrado para empresa ${tenantId}`)
        return admin.id
    }
}