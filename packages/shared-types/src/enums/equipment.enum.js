"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentEntity = exports.MovementStatus = exports.MovementType = exports.EquipmentCriticality = exports.EquipmentStatus = void 0;
exports.EquipmentStatus = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
    SCRAPPED: 'SCRAPPED',
    BORROWED: 'BORROWED',
};
exports.EquipmentCriticality = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
};
exports.MovementType = {
    TRANSFER: 'TRANSFER',
    LOAN: 'LOAN',
};
exports.MovementStatus = {
    ACTIVE: 'ACTIVE',
    RETURNED: 'RETURNED',
    CANCELLED: 'CANCELLED',
};
exports.AttachmentEntity = {
    EQUIPMENT: 'EQUIPMENT',
    SERVICE_ORDER: 'SERVICE_ORDER',
    MAINTENANCE: 'MAINTENANCE',
    INVOICE: 'INVOICE',
    AVATAR: 'AVATAR',
    COMMENT: 'COMMENT',
};
//# sourceMappingURL=equipment.enum.js.map