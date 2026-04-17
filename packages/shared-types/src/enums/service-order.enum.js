"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskStatus = exports.ServiceOrderTechnicianRole = exports.ServiceOrderPriority = exports.ServiceOrderStatus = void 0;
exports.ServiceOrderStatus = {
    OPEN: 'OPEN',
    AWAITING_PICKUP: 'AWAITING_PICKUP',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    COMPLETED_APPROVED: 'COMPLETED_APPROVED',
    COMPLETED_REJECTED: 'COMPLETED_REJECTED',
    CANCELLED: 'CANCELLED',
};
exports.ServiceOrderPriority = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
};
exports.ServiceOrderTechnicianRole = {
    LEAD: 'LEAD',
    ASSISTANT: 'ASSISTANT',
};
exports.TaskStatus = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
};
//# sourceMappingURL=service-order.enum.js.map