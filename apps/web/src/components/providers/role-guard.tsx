"use client";

import { usePermissions } from "@/hooks/auth/use-permissions";
import type { Role } from "@/types/auth";

interface RoleGuardProps {
    children: React.ReactNode;
    roles?: Role[];
    fallback?: React.ReactNode;

    // Atalhos para as permissões mais comuns
    requireSuperAdmin?: boolean;
    requireManager?: boolean;
    requireCompanyLevel?: boolean;
}

export function RoleGuard({
    children,
    roles,
    fallback = null,
    requireSuperAdmin,
    requireManager,
    requireCompanyLevel,
}: RoleGuardProps) {
    const permissions = usePermissions();

    // Verifica por roles específicos
    if (roles && !roles.includes(permissions.role!)) {
        return <>{fallback}</>;
    }

    // Atalhos
    if (requireSuperAdmin && !permissions.isSuperAdmin) {
        return <>{fallback}</>;
    }

    if (requireManager && !permissions.isManager) {
        return <>{fallback}</>;
    }

    if (requireCompanyLevel && !permissions.isCompanyLevel) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}