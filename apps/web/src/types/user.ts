import type { Role } from "./auth";

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: "ACTIVE" | "INACTIVE" | "UNVERIFIED" | "BLOCKED";
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
    role: Role;
    phone?: string;
    clientId?: string;
}

export interface UpdateUserDto {
    name?: string;
    phone?: string;
    status?: "ACTIVE" | "INACTIVE";
}

export interface ListUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    status?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}