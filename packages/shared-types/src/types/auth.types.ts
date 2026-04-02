import type { UserRole, UserStatus } from '../enums/user.enum';

export type { UserRole };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  phone?: string | null;
  telegramChatId?: string | null;
  tenantId?: string | null;
  organizationId?: string | null;
  customRoleId?: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
    logoUrl?: string | null;
  } | null;
  customRole?: {
    id: string;
    name: string;
    description?: string | null;
    permissions: { resource: string; action: string }[];
  } | null;
}

export interface LoginResponse {
  user: AuthUser;
  requires2FA?: boolean;
}

export type AuthMeResponse = AuthUser;

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 7,
  COMPANY_ADMIN: 6,
  COMPANY_MANAGER: 5,
  TECHNICIAN: 4,
  CLIENT_ADMIN: 3,
  CLIENT_USER: 2,
  CLIENT_VIEWER: 1,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Administrador',
  COMPANY_MANAGER: 'Gerente',
  TECHNICIAN: 'Técnico',
  CLIENT_ADMIN: 'Admin do Cliente',
  CLIENT_USER: 'Usuário',
  CLIENT_VIEWER: 'Visualizador',
};
