import type { UserRole, UserStatus } from '../enums/user.enum';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  avatarUrl?: string | null;
  companyId?: string | null;
  clientId?: string | null;
  customRoleId?: string | null;
  customRole?: { id: string; name: string } | null;
  require2FA?: boolean;
  company?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  client?: {
    id: string;
    name: string;
  } | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  companyId?: string;
  clientId?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  phone?: string;
  telegramChatId?: string;
  status?: UserStatus;
  role?: UserRole;
  require2FA?: boolean;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  companyId?: string;
  clientId?: string;
}
