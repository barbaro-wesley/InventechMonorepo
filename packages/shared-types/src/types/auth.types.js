"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_LABELS = exports.ROLE_HIERARCHY = void 0;
exports.hasRole = hasRole;
exports.ROLE_HIERARCHY = {
    SUPER_ADMIN: 7,
    COMPANY_ADMIN: 6,
    COMPANY_MANAGER: 5,
    TECHNICIAN: 4,
    CLIENT_ADMIN: 3,
    CLIENT_USER: 2,
    CLIENT_VIEWER: 1,
    MEMBER: 0,
};
function hasRole(userRole, requiredRole) {
    return exports.ROLE_HIERARCHY[userRole] >= exports.ROLE_HIERARCHY[requiredRole];
}
exports.ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    COMPANY_ADMIN: 'Administrador',
    COMPANY_MANAGER: 'Gerente',
    TECHNICIAN: 'Técnico',
    CLIENT_ADMIN: 'Admin do Prestador',
    CLIENT_USER: 'Usuário do Prestador',
    CLIENT_VIEWER: 'Visualizador do Prestador',
    MEMBER: 'Membro',
};
//# sourceMappingURL=auth.types.js.map