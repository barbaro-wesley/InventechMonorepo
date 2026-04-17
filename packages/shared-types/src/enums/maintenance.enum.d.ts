export declare const MaintenanceType: {
    readonly PREVENTIVE: "PREVENTIVE";
    readonly CORRECTIVE: "CORRECTIVE";
    readonly INITIAL_ACCEPTANCE: "INITIAL_ACCEPTANCE";
    readonly EXTERNAL_SERVICE: "EXTERNAL_SERVICE";
    readonly TECHNOVIGILANCE: "TECHNOVIGILANCE";
    readonly TRAINING: "TRAINING";
    readonly IMPROPER_USE: "IMPROPER_USE";
    readonly DEACTIVATION: "DEACTIVATION";
};
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];
export declare const RecurrenceType: {
    readonly DAILY: "DAILY";
    readonly WEEKLY: "WEEKLY";
    readonly BIWEEKLY: "BIWEEKLY";
    readonly MONTHLY: "MONTHLY";
    readonly QUARTERLY: "QUARTERLY";
    readonly SEMIANNUAL: "SEMIANNUAL";
    readonly ANNUAL: "ANNUAL";
    readonly CUSTOM: "CUSTOM";
};
export type RecurrenceType = (typeof RecurrenceType)[keyof typeof RecurrenceType];
//# sourceMappingURL=maintenance.enum.d.ts.map