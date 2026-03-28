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
        isCompanyLevel: isRole(
            "SUPER_ADMIN",
            "COMPANY_ADMIN",
            "COMPANY_MANAGER",
            "TECHNICIAN"
        ),
        isClientLevel: isRole("CLIENT_ADMIN", "CLIENT_USER", "CLIENT_VIEWER"),
        isManager: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"),

        // Permissões por tela
        canManageCompanies: isRole("SUPER_ADMIN"),
        canManageLicenses: isRole("SUPER_ADMIN"),
        canManageUsers: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "CLIENT_ADMIN"),
        canManageClients: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER"),
        canManageEquipment: isRole(
            "SUPER_ADMIN",
            "COMPANY_ADMIN",
            "COMPANY_MANAGER",
            "TECHNICIAN"
        ),
        canManageServiceOrders: isRole(
            "SUPER_ADMIN",
            "COMPANY_ADMIN",
            "COMPANY_MANAGER",
            "TECHNICIAN",
            "CLIENT_ADMIN",
            "CLIENT_USER"
        ),
        canViewReports: isRole(
            "SUPER_ADMIN",
            "COMPANY_ADMIN",
            "COMPANY_MANAGER",
            "CLIENT_ADMIN"
        ),
        canViewDashboard: isRole(
            "SUPER_ADMIN",
            "COMPANY_ADMIN",
            "COMPANY_MANAGER",
            "CLIENT_ADMIN",
            "CLIENT_USER"
        ),

        // Funções utilitárias
        hasRole,
        isRole,
    };
}