import { Injectable, NotFoundException } from '@nestjs/common'
import { EventType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto'
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto'
import { ListAlertRulesDto } from './dto/list-alert-rules.dto'
import {
    EVENT_VARIABLE_REGISTRY,
    VariableDefinition,
    CONTEXTUAL_BY_EVENT,
    CONTEXTUAL_LABELS,
    interpolate,
} from './alert-rules.variables'
import { buildUniversalEmail } from '../notifications/channels/templates/universal.template'

const ALERT_RULE_SELECT = {
    id: true,
    companyId: true,
    createdById: true,
    name: true,
    description: true,
    isActive: true,
    triggerEvent: true,
    conditions: true,
    headerColor: true,
    headerTitle: true,
    bodyTemplate: true,
    tableFields: true,
    buttonLabel: true,
    buttonUrlTemplate: true,
    footerNote: true,
    recipientRoles: true,
    recipientGroupIds: true,
    recipientUserIds: true,
    recipientContextual: true,
    recipientCustomRoleIds: true,
    channels: true,
    fireCount: true,
    lastFiredAt: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.AlertRuleSelect

@Injectable()
export class AlertRulesService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(companyId: string, filters: ListAlertRulesDto) {
        const { page = 1, limit = 20, search, triggerEvent, isActive } = filters
        const skip = (page - 1) * limit

        const where: Prisma.AlertRuleWhereInput = {
            companyId,
            ...(search && {
                name: { contains: search, mode: 'insensitive' },
            }),
            ...(triggerEvent !== undefined && { triggerEvent }),
            ...(isActive !== undefined && { isActive }),
        }

        const [data, total] = await Promise.all([
            this.prisma.alertRule.findMany({
                where,
                select: ALERT_RULE_SELECT,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.alertRule.count({ where }),
        ])

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        }
    }

    async findOne(id: string, companyId: string) {
        const rule = await this.prisma.alertRule.findFirst({
            where: { id, companyId },
            select: ALERT_RULE_SELECT,
        })

        if (!rule) throw new NotFoundException('Regra de alerta não encontrada')

        return rule
    }

    async create(dto: CreateAlertRuleDto, user: AuthenticatedUser) {
        return this.prisma.alertRule.create({
            data: {
                companyId: user.companyId!,
                createdById: user.sub,
                name: dto.name,
                description: dto.description,
                isActive: dto.isActive ?? true,
                triggerEvent: dto.triggerEvent,
                conditions: (dto.conditions ?? []) as unknown as Prisma.InputJsonValue,
                headerColor: dto.headerColor ?? '#6366F1',
                headerTitle: dto.headerTitle,
                bodyTemplate: dto.bodyTemplate,
                tableFields: (dto.tableFields ?? []) as unknown as Prisma.InputJsonValue,
                buttonLabel: dto.buttonLabel,
                buttonUrlTemplate: dto.buttonUrlTemplate,
                footerNote: dto.footerNote,
                recipientRoles: dto.recipientRoles ?? [],
                recipientGroupIds: dto.recipientGroupIds ?? [],
                recipientUserIds: dto.recipientUserIds ?? [],
                recipientContextual: dto.recipientContextual ?? [],
                recipientCustomRoleIds: dto.recipientCustomRoleIds ?? [],
                channels: dto.channels,
            },
            select: ALERT_RULE_SELECT,
        })
    }

    async update(id: string, dto: UpdateAlertRuleDto, companyId: string) {
        await this.findOne(id, companyId)

        return this.prisma.alertRule.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                ...(dto.triggerEvent !== undefined && { triggerEvent: dto.triggerEvent }),
                ...(dto.conditions !== undefined && { conditions: dto.conditions as unknown as Prisma.InputJsonValue }),
                ...(dto.headerColor !== undefined && { headerColor: dto.headerColor }),
                ...(dto.headerTitle !== undefined && { headerTitle: dto.headerTitle }),
                ...(dto.bodyTemplate !== undefined && { bodyTemplate: dto.bodyTemplate }),
                ...(dto.tableFields !== undefined && { tableFields: dto.tableFields as unknown as Prisma.InputJsonValue }),
                ...(dto.buttonLabel !== undefined && { buttonLabel: dto.buttonLabel }),
                ...(dto.buttonUrlTemplate !== undefined && { buttonUrlTemplate: dto.buttonUrlTemplate }),
                ...(dto.footerNote !== undefined && { footerNote: dto.footerNote }),
                ...(dto.recipientRoles !== undefined && { recipientRoles: dto.recipientRoles }),
                ...(dto.recipientGroupIds !== undefined && { recipientGroupIds: dto.recipientGroupIds }),
                ...(dto.recipientUserIds !== undefined && { recipientUserIds: dto.recipientUserIds }),
                ...(dto.recipientContextual !== undefined && { recipientContextual: dto.recipientContextual }),
                ...(dto.recipientCustomRoleIds !== undefined && { recipientCustomRoleIds: dto.recipientCustomRoleIds }),
                ...(dto.channels !== undefined && { channels: dto.channels }),
            },
            select: ALERT_RULE_SELECT,
        })
    }

    async remove(id: string, companyId: string): Promise<void> {
        await this.findOne(id, companyId)
        await this.prisma.alertRule.delete({ where: { id } })
    }

    async toggleActive(id: string, companyId: string) {
        const rule = await this.findOne(id, companyId)

        return this.prisma.alertRule.update({
            where: { id },
            data: { isActive: !rule.isActive },
            select: ALERT_RULE_SELECT,
        })
    }

    async previewEmail(id: string, sampleData: Record<string, any>, companyId: string) {
        const rule = await this.findOne(id, companyId)

        const tableFields = rule.tableFields as string[]
        const variables = EVENT_VARIABLE_REGISTRY[rule.triggerEvent] ?? []

        const tableRows = tableFields
            .map((key) => {
                const def = variables.find((v) => v.key === key)
                return def ? { label: def.label, value: String(sampleData[key] ?? `{{${key}}}`) } : null
            })
            .filter(Boolean) as { label: string; value: string }[]

        return buildUniversalEmail({
            subject: interpolate(rule.headerTitle, sampleData),
            headerColor: rule.headerColor,
            headerTitle: interpolate(rule.headerTitle, sampleData),
            bodyHtml: interpolate(rule.bodyTemplate, sampleData),
            tableRows,
            buttonLabel: rule.buttonLabel ?? undefined,
            buttonUrl: rule.buttonUrlTemplate ? interpolate(rule.buttonUrlTemplate, sampleData) : undefined,
            footerNote: rule.footerNote ?? undefined,
        })
    }

    getVariableRegistry() {
        // Retorna variáveis de template + destinatários contextuais disponíveis por evento
        const result: Record<string, {
            variables: VariableDefinition[]
            contextualRecipients: { key: string; label: string }[]
        }> = {}

        for (const event of Object.values(EventType)) {
            result[event] = {
                variables: EVENT_VARIABLE_REGISTRY[event] ?? [],
                contextualRecipients: (CONTEXTUAL_BY_EVENT[event] ?? []).map((key) => ({
                    key,
                    label: CONTEXTUAL_LABELS[key],
                })),
            }
        }

        return result
    }
}
