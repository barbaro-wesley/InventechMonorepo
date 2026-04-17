export declare const EquipmentStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly INACTIVE: "INACTIVE";
    readonly UNDER_MAINTENANCE: "UNDER_MAINTENANCE";
    readonly SCRAPPED: "SCRAPPED";
    readonly BORROWED: "BORROWED";
};
export type EquipmentStatus = (typeof EquipmentStatus)[keyof typeof EquipmentStatus];
export declare const EquipmentCriticality: {
    readonly LOW: "LOW";
    readonly MEDIUM: "MEDIUM";
    readonly HIGH: "HIGH";
    readonly CRITICAL: "CRITICAL";
};
export type EquipmentCriticality = (typeof EquipmentCriticality)[keyof typeof EquipmentCriticality];
export declare const MovementType: {
    readonly TRANSFER: "TRANSFER";
    readonly LOAN: "LOAN";
};
export type MovementType = (typeof MovementType)[keyof typeof MovementType];
export declare const MovementStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly RETURNED: "RETURNED";
    readonly CANCELLED: "CANCELLED";
};
export type MovementStatus = (typeof MovementStatus)[keyof typeof MovementStatus];
export declare const AttachmentEntity: {
    readonly EQUIPMENT: "EQUIPMENT";
    readonly SERVICE_ORDER: "SERVICE_ORDER";
    readonly MAINTENANCE: "MAINTENANCE";
    readonly INVOICE: "INVOICE";
    readonly AVATAR: "AVATAR";
    readonly COMMENT: "COMMENT";
};
export type AttachmentEntity = (typeof AttachmentEntity)[keyof typeof AttachmentEntity];
//# sourceMappingURL=equipment.enum.d.ts.map