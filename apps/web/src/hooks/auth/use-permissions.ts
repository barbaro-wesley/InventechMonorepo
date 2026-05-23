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

        // Permissões por tela — usam canSeeNav para respeitar tanto roles fixos quanto a matriz de permissões
        canManageCompanies: isRole("SUPER_ADMIN"),
        canManageLicenses: isRole("SUPER_ADMIN"),
        // user:create = [SA, CA, CM] — CLIENT_ADMIN incluído via canSeeNav se tiver a permissão no override
        canManageUsers: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER"], "user:create"),
        canManageClients: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER"], "client:create"),
        // equipment:create = [SA, CA, CM, CLA, CLU] — TECHNICIAN não tem permissão de escrita por padrão
        canManageEquipment: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN", "CLIENT_USER"], "equipment:create"),
        canManageEquipmentSubtypes: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER"], "equipment-type:create-sub"),
        canManageServiceOrders: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER"),
        // Visualizar o módulo de estoque — gestores, técnicos e prestadores (CLIENT_ADMIN)
        canViewInventory: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN"], "inventory:list"),
        // Gerenciar itens e configurações do estoque
        canManageInventory: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER"], "inventory:create"),
        // Gerenciar pontos de estoque (criar/editar/excluir/vincular clientes)
        canManageInventoryPoints: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER"], "inventory-point:create"),
        // Fazer movimentações (entradas, saídas, ajustes) — técnicos e prestadores incluídos
        canCreateInventoryMovements: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN"], "inventory-movement:create"),
        // Transferir itens entre pontos — apenas gestores
        canTransferInventory: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER"], "inventory-movement:transfer"),
        // Visualizar módulo de acessórios — empresa + cliente com acesso
        canViewAccessories: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN", "CLIENT_ADMIN", "CLIENT_USER", "CLIENT_VIEWER"], "accessories:read"),
        // Criar/editar acessórios
        canManageAccessories: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN"], "accessories:create"),
        // Vincular/desvincular acessórios a equipamentos
        canAssignAccessories: canSeeNav(["COMPANY_ADMIN", "COMPANY_MANAGER", "TECHNICIAN"], "accessory_assignments:assign"),
        canViewReports: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN"),
        canViewDashboard: isRole("SUPER_ADMIN", "COMPANY_ADMIN", "COMPANY_MANAGER", "CLIENT_ADMIN", "CLIENT_USER"),

        // Funções utilitárias
        hasRole,
        isRole,
        canAccess,
        canSeeNav,
    };
}