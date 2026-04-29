import {
    IsString, IsOptional, IsBoolean, IsEnum,
    IsArray, IsHexColor, ValidateNested, IsUUID,
} from 'class-validator'
import { Type } from 'class-transformer'
import { EventType, NotificationChannel, UserRole, ContextualRecipient } from '@prisma/client'
import type { ConditionOperator } from '@inventech/shared-types'

const CONDITION_OPERATORS: ConditionOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']

export class AlertRuleConditionDto {
    @IsString()
    field: string

    @IsEnum(CONDITION_OPERATORS)
    operator: ConditionOperator

    value: string | number | boolean | string[]
}

export class CreateAlertRuleDto {
    @IsString()
    name: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsBoolean()
    isActive?: boolean

    @IsEnum(EventType)
    triggerEvent: EventType

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AlertRuleConditionDto)
    conditions?: AlertRuleConditionDto[]

    @IsOptional()
    @IsHexColor()
    headerColor?: string

    @IsString()
    headerTitle: string

    @IsString()
    bodyTemplate: string

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tableFields?: string[]

    @IsOptional()
    @IsString()
    buttonLabel?: string

    @IsOptional()
    @IsString()
    buttonUrlTemplate?: string

    @IsOptional()
    @IsString()
    footerNote?: string

    @IsOptional()
    @IsArray()
    @IsEnum(UserRole, { each: true })
    recipientRoles?: UserRole[]

    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    recipientGroupIds?: string[]

    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    recipientUserIds?: string[]

    @IsOptional()
    @IsArray()
    @IsEnum(ContextualRecipient, { each: true })
    recipientContextual?: ContextualRecipient[]

    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    recipientCustomRoleIds?: string[]

    @IsArray()
    @IsEnum(NotificationChannel, { each: true })
    channels: NotificationChannel[]
}
