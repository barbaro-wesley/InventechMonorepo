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
  company?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  client?: {
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
  clientId?: string;
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  status?: UserStatus;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}
