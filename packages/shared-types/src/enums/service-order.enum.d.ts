export declare const ServiceOrderStatus: {
    readonly OPEN: "OPEN";
    readonly AWAITING_PICKUP: "AWAITING_PICKUP";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly COMPLETED: "COMPLETED";
    readonly COMPLETED_APPROVED: "COMPLETED_APPROVED";
    readonly COMPLETED_REJECTED: "COMPLETED_REJECTED";
    readonly CANCELLED: "CANCELLED";
};
export type ServiceOrderStatus = (typeof ServiceOrderStatus)[keyof typeof ServiceOrderStatus];
export declare const ServiceOrderPriority: {
    readonly LOW: "LOW";
    readonly MEDIUM: "MEDIUM";
    readonly HIGH: "HIGH";
    readonly URGENT: "URGENT";
};
export type ServiceOrderPriority = (typeof ServiceOrderPriority)[keyof typeof ServiceOrderPriority];
export declare const ServiceOrderTechnicianRole: {
    readonly LEAD: "LEAD";
    readonly ASSISTANT: "ASSISTANT";
};
export type ServiceOrderTechnicianRole = (typeof ServiceOrderTechnicianRole)[keyof typeof ServiceOrderTechnicianRole];
export declare const TaskStatus: {
    readonly TODO: "TODO";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly DONE: "DONE";
};
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
//# sourceMappingURL=service-order.enum.d.ts.map