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
    companyId?: string | null;
    clientId?: string | null;
    customRoleId?: string | null;
    /** Permissões efetivas no formato "resource:action" — sempre populado pelo /auth/me */
    permissions: string[];
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
    customRole?: {
        id: string;
        name: string;
    } | null;
}
export interface LoginResponse {
    user: AuthUser;
    requires2FA?: boolean;
}
export type AuthMeResponse = AuthUser;
export declare const ROLE_HIERARCHY: Record<UserRole, number>;
export declare function hasRole(userRole: UserRole, requiredRole: UserRole): boolean;
export declare const ROLE_LABELS: Record<UserRole, string>;
//# sourceMappingURL=auth.types.d.ts.map