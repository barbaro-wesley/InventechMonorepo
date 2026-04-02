import { api } from "@/lib/api";
import type {
    Tenant,
    TenantWithLicense,
    TenantLicenseRow,
    CreateTenantDto,
    CreateTenantResponse,
    UpdateTenantDto,
    UpdateReportSettingsDto,
    ListTenantsParams,
    License,
} from "@/types/company";
import type { PaginatedResponse } from "@/types/user";

export const tenantsService = {
    async list(params?: ListTenantsParams): Promise<PaginatedResponse<Tenant>> {
        const { data } = await api.get("/tenants", { params });
        return {
            data: data.data,
            pagination: data.pagination,
        };
    },

    async getById(id: string): Promise<TenantWithLicense> {
        const { data } = await api.get(`/tenants/${id}`);
        return data;
    },

    async create(dto: CreateTenantDto): Promise<CreateTenantResponse> {
        const { data } = await api.post("/tenants", dto);
        return data;
    },

    async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
        const { data } = await api.patch(`/tenants/${id}`, dto);
        return data;
    },

    // Licenças — só SUPER_ADMIN
    async getLicense(tenantId: string): Promise<License> {
        const { data } = await api.get(`/tenants/${tenantId}/license`);
        return data;
    },

    async getAllLicenses(params?: {
        expiringInDays?: number;
        status?: string;
    }): Promise<TenantLicenseRow[]> {
        const { data } = await api.get("/tenants/licenses/all", { params });
        return data;
    },

    async suspend(tenantId: string, reason: string): Promise<void> {
        await api.patch(`/tenants/${tenantId}/suspend`, { reason });
    },

    async activate(tenantId: string): Promise<void> {
        await api.patch(`/tenants/${tenantId}/activate`);
    },

    async updateLicense(
        tenantId: string,
        dto: { expiresAt?: string; notes?: string }
    ): Promise<void> {
        await api.patch(`/tenants/${tenantId}/license`, dto);
    },

    async updateTrial(
        tenantId: string,
        dto: { trialEndsAt: string }
    ): Promise<void> {
        await api.patch(`/tenants/${tenantId}/trial`, dto);
    },

    async uploadLogo(
        tenantId: string,
        file: File
    ): Promise<{ logoUrl: string }> {
        const form = new FormData();
        form.append("logo", file);
        const { data } = await api.post(`/tenants/${tenantId}/logo`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },

    async updateReportSettings(
        tenantId: string,
        dto: UpdateReportSettingsDto
    ): Promise<void> {
        await api.patch(`/tenants/${tenantId}/report-settings`, dto);
    },
};
