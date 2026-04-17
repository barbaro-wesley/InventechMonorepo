export declare const NotificationChannel: {
    readonly EMAIL: "EMAIL";
    readonly TELEGRAM: "TELEGRAM";
    readonly WEBSOCKET: "WEBSOCKET";
};
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
export declare const NotificationStatus: {
    readonly PENDING: "PENDING";
    readonly SENT: "SENT";
    readonly FAILED: "FAILED";
};
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
//# sourceMappingURL=notification.enum.d.ts.map