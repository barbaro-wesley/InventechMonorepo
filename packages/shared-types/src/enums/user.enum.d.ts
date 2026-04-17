export declare const UserRole: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly COMPANY_ADMIN: "COMPANY_ADMIN";
    readonly COMPANY_MANAGER: "COMPANY_MANAGER";
    readonly TECHNICIAN: "TECHNICIAN";
    readonly CLIENT_ADMIN: "CLIENT_ADMIN";
    readonly CLIENT_USER: "CLIENT_USER";
    readonly CLIENT_VIEWER: "CLIENT_VIEWER";
    readonly MEMBER: "MEMBER";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const UserStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly INACTIVE: "INACTIVE";
    readonly SUSPENDED: "SUSPENDED";
    readonly BLOCKED: "BLOCKED";
    readonly UNVERIFIED: "UNVERIFIED";
};
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
//# sourceMappingURL=user.enum.d.ts.map