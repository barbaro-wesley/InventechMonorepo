import type { UserRole, UserStatus } from '../enums/user.enum';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  avatarUrl?: string | null;
  tenantId?: string | null;
  organizationId?: string | null;
  customRoleId?: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  tenantId?: string;
  organizationId?: string;
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  telegramChatId?: string;
  status?: UserStatus;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  tenantId?: string;
  organizationId?: string;
}
