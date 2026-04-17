import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { UserRole, NotificationChannel, ContextualRecipient } from '@prisma/client'

export class UpsertNotificationConfigDto {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean

    @IsOptional()
    @IsArray()
    @IsEnum(UserRole, { each: true })
    recipientRoles?: UserRole[]

    @IsOptional()
    @IsArray()
    @IsEnum(ContextualRecipient, { each: true })
    recipientContextual?: ContextualRecipient[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    recipientGroupIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    recipientUserIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    recipientCustomRoleIds?: string[]

    @IsOptional()
    @IsArray()
    @IsEnum(NotificationChannel, { each: true })
    channels?: NotificationChannel[]
}
