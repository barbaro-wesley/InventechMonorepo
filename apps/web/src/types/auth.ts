export type Role =
    | "SUPER_ADMIN"
    | "COMPANY_ADMIN"
    | "COMPANY_MANAGER"
    | "TECHNICIAN"
    | "CLIENT_ADMIN"
    | "CLIENT_USER"
    | "CLIENT_VIEWER";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: "ACTIVE" | "INACTIVE" | "UNVERIFIED" | "BLOCKED";
    avatarUrl?: string | null;
    companyId?: string | null;
    clientId?: string | null;
    company?: {
        id: string;
        name: string;
        slug: string;
        logoUrl?: string | null;
    } | null;
    client?: {
        id: string;
        name: string;
        logoUrl?: string | null;
    } | null;
}

export interface LoginResponse {
    user: AuthUser;
    requires2FA?: boolean;
}

export type AuthMeResponse = AuthUser;

export const ROLE_HIERARCHY: Record<Role, number> = {
    SUPER_ADMIN: 7,
    COMPANY_ADMIN: 6,
    COMPANY_MANAGER: 5,
    TECHNICIAN: 4,
    CLIENT_ADMIN: 3,
    CLIENT_USER: 2,
    CLIENT_VIEWER: 1,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const ROLE_LABELS: Record<Role, string> = {
    SUPER_ADMIN: "Super Admin",
    COMPANY_ADMIN: "Administrador",
    COMPANY_MANAGER: "Gerente",
    TECHNICIAN: "Técnico",
    CLIENT_ADMIN: "Admin do Cliente",
    CLIENT_USER: "Usuário",
    CLIENT_VIEWER: "Visualizador",
};