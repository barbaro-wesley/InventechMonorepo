import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsInt, IsArray, IsDateString, IsUUID, MinLength, IsObject } from 'class-validator'
import { Type } from 'class-transformer'
import { ESignNotificationChannel, ESignReferenceType, ESignSignatureType } from '@prisma/client'

export class CreateESignDocumentDto {
  @IsString()
  @MinLength(3)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(ESignReferenceType)
  referenceType: ESignReferenceType

  @IsOptional()
  @IsUUID()
  referenceId?: string

  @IsBoolean()
  @IsOptional()
  requireSigningOrder?: boolean

  @IsOptional()
  @IsDateString()
  expiresAt?: string

  @IsOptional()
  @IsObject()
  settings?: {
    sendCopyTo?: string[]
    reminderAfterDays?: number
    allowDecline?: boolean
  }
}

export class AddESignRequestDto {
  @IsString()
  @MinLength(2)
  signerName: string

  @IsEmail()
  signerEmail: string

  @IsOptional()
  @IsString()
  signerPhone?: string

  @IsOptional()
  @IsString()
  signerCpf?: string

  @IsString()
  signerRole: string

  @IsOptional()
  @IsUUID()
  signerUserId?: string

  @IsInt()
  @IsOptional()
  signingOrder?: number

  @IsArray()
  @IsEnum(ESignNotificationChannel, { each: true })
  notificationChannels: ESignNotificationChannel[]

  @IsOptional()
  @IsString()
  customMessage?: string
}

export class SubmitSignatureDto {
  @IsString()
  signatureData: string

  @IsEnum(ESignSignatureType)
  signatureType: ESignSignatureType

  @IsOptional()
  @IsObject()
  geolocation?: {
    lat: number
    lng: number
    city?: string
    state?: string
    country?: string
  }

  @IsOptional()
  @IsString()
  deviceFingerprint?: string
}

export class DeclineSignatureDto {
  @IsString()
  @MinLength(5)
  reason: string
}

export class SendReminderDto {
  @IsString()
  requestId: string
}

export class ListESignDocumentsDto {
  @IsOptional()
  @IsEnum(ESignReferenceType)
  referenceType?: ESignReferenceType

  @IsOptional()
  @IsString()
  referenceId?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20
}
