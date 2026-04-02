import { UserRole } from '@prisma/client'

export interface AuthenticatedUser {
  sub: string              // userId
  email: string
  role: UserRole
  tenantId: string | null
  organizationId: string | null
  customRoleId: string | null  // papel personalizado — sobrepõe permissões do system role
}