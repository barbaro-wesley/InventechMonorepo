export interface Company {
    id: string;
    name: string;
    slug: string;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
    isActive: boolean;
    createdAt: string;
    _count?: {
        clients: number;
        users: number;
    };
}

export interface License {
    status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "EXPIRED";
    expiresAt?: string | null;
    trialEndsAt?: string | null;
    suspendedAt?: string | null;
    suspensionReason?: string | null;
    notes?: string | null;
}

export interface CompanyWithLicense extends Company {
    license?: License | null;
}

export interface CreateCompanyDto {
    name: string;
    document?: string;
    email?: string;
    phone?: string;
    admin: {
        name: string;
        email: string;
        password: string;
    };
}

export interface UpdateCompanyDto {
    name?: string;
    document?: string;
    email?: string;
    phone?: string;
}

export interface ListCompaniesParams {
    page?: number;
    limit?: number;
    search?: string;
}