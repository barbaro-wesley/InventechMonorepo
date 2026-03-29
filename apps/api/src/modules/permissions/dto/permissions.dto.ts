import {
  IsString, IsArray, IsEnum, IsOptional, IsBoolean, MinLength, ArrayNotEmpty,
} from 'class-validator'
import { UserRole } from '@prisma/client'

export class UpsertResourcePermissionDto {
  @IsString()
  resource: string

  @IsString()
  action: string

  @IsArray()
  @IsEnum(UserRole, { each: true })
  @ArrayNotEmpty()
  allowedRoles: UserRole[]
}

export class RemoveResourcePermissionDto {
  @IsString()
  resource: string

  @IsString()
  action: string
}

export class CreateCustomRoleDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsOptional()
  @IsString()
  description?: string
}

export class UpdateCustomRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class SetCustomRolePermissionsDto {
  @IsArray()
  permissions: { resource: string; action: string }[]
}

export class AssignCustomRoleDto {
  @IsOptional()
  @IsString()
  customRoleId?: string | null  // null = remove custom role do usuário
}
