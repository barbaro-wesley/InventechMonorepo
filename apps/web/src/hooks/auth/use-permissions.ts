import { useCurrentUser } from "@/store/auth.store";
import { ROLE_HIERARCHY, type Role } from "@/types/auth";

export function usePermissions() {
    const user = useCurrentUser();

    function hasRole(requiredRole: Role): boolean {
        if (!user) return false;
        return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
    }

    function isRole(...roles: Role[]): boolean {
        if (!user) return false;
        return roles.includes(user.role);
    }

    /**
     * Verifica acesso a um recurso:ação específico.
     * - SUPER_ADMIN: sempre true
     * - Usuário com papel personalizado: verifica permissões explícitas carregadas no auth
     * - Papel de sistema: verifica pelo array de roles do nav item (use isRole/hasRole)
     */
    function canAccess(resource: string, action: string): boolean {
        if (!user) return false;
        if (user.role === "SUPER_ADMIN") return true;
        // Verifica user.permissions para tanto papéis personalizados quanto de sistema.
        // Permissões de sistema são derivadas da matriz de papéis configurada via UI.
        return user.permissions?.includes(`${resource}:${action}`) ?? false;
    }

    /**
     * Verifica se o usuário pode ver um item de navegação.
     * Custom role users: usa apenas user.permissions (canAccess).
     * System role users: usa roles[] OU user.permissions se o item tiver permission key.
     * Isso permite que permissões concedidas via matriz de papéis (UI) funcionem
     * tanto para papéis personalizados quanto para papéis de sistema.
     */
    function canSeeNav(roles: Role[], permission?: string): boolean {
        if (!user) return false;
        if (user.role === "SUPER_ADMIN") return true;
        if (user.customRoleId && permission) {
            const [resource, action] = permission.split(":");
            return canAccess(resource, action);
        }
        // Papel de sistema: verifica roles[] primeiro, depois user.permissions
        if (roles.includes(user.role as Role)) return true;
        if (permission && (user.permissions?.includes(permission) ?? false)) return true;
        return false;
    }

    return {
        user,
        role: user?.role,

        // Verificações diretas
        isSuperAdmin: user?.role === "SUPER_ADMIN",
        isCompanyAdmin: user?.role === "COMPANY_ADMIN",
        isCompanyManager: user?.role === "COMPANY_MANAGER",
        isTechnician: user?.role === "TECHNICIAN",
        isClientAdmin: user?.role === "CLIENT_ADMIN",
        isClientUser: user?.role === "CLIENT_USER",
        isClientViewer: user?.role === "CLIENT_VIEWER",

        // Verificações de grupo
        isCompanyLevel: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN"),
        isClientLevel: isRole("CLIENT_ADMIN", "CLIENT_USER", "CLIENT_VIEWER"),
        isManager: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"),

        // Permissões por tela (system roles)
        canManageCompanies: isRole("SUPER_ADMIN"),
        canManageLicenses: isRole("SUPER_ADMIN"),
        canManageUsers: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "CLIENT_ADMIN"),
        canManageClients: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"),
        canManageEquipment: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN"),
        canManageServiceOrders: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER"),
        canViewReports: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"),
        canViewDashboard: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN", "CLIENT_USER"),

        // Funções utilitárias
        hasRole,
        isRole,
        canAccess,
        canSeeNav,
    };
}